/**
 * Export Prompt API
 *
 * POST /api/sessions/[id]/export-prompt - Generate Claude Code prompt from session with attachments as ZIP
 * Admin only
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import archiver from 'archiver';
import { Readable } from 'stream';

async function verifyAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === 'admin';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin only
    const isAdmin = await verifyAdmin(session.user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: sessionId } = await params;

    // Get full session data with all relations
    const patternSession = await prisma.patternSession.findUnique({
      where: { id: sessionId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        detections: {
          orderBy: { candleTime: 'asc' },
        },
        corrections: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!patternSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Generate formatted prompt
    const prompt = generatePrompt(patternSession);

    // Generate JSON export (for downloading)
    const jsonExport = {
      session: {
        id: patternSession.id,
        name: patternSession.name,
        symbol: patternSession.symbol,
        timeframe: patternSession.timeframe,
        patternType: patternSession.patternType,
        patternVersion: patternSession.patternVersion,
        feedbackType: patternSession.feedbackType,
        description: patternSession.description,
        createdAt: patternSession.createdAt,
      },
      user: patternSession.createdBy,
      detections: patternSession.detections,
      corrections: patternSession.corrections,
      comments: patternSession.comments,
      candleData: patternSession.candleData,
    };

    // Collect all attachment URLs
    const attachments: Array<{ url: string; name: string; category: string }> = [];

    // From corrections
    patternSession.corrections.forEach((correction: any) => {
      if (correction.attachments && Array.isArray(correction.attachments)) {
        correction.attachments.forEach((att: any) => {
          attachments.push({
            url: att.url,
            name: att.name || `correction-${correction.id}-${attachments.length}`,
            category: att.category || 'document',
          });
        });
      }
    });

    // From comments
    patternSession.comments.forEach((comment: any) => {
      if (comment.attachments && Array.isArray(comment.attachments)) {
        comment.attachments.forEach((att: any) => {
          attachments.push({
            url: att.url,
            name: att.name || `comment-${comment.id}-${attachments.length}`,
            category: att.category || 'document',
          });
        });
      }
    });

    // Create ZIP file with prompt, JSON, and all attachments
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Create a readable stream for Next.js response
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));

    await new Promise<void>((resolve, reject) => {
      archive.on('end', resolve);
      archive.on('error', reject);

      // Add prompt as markdown file
      archive.append(prompt, { name: 'prompt.md' });

      // Add JSON export
      archive.append(JSON.stringify(jsonExport, null, 2), { name: 'session-data.json' });

      // Download and add all attachments
      const downloadPromises = attachments.map(async (att) => {
        try {
          const response = await fetch(att.url);
          if (!response.ok) {
            console.warn(`Failed to download attachment: ${att.url}`);
            return;
          }

          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Organize by category
          const folder = att.category === 'image' ? 'screenshots' : 'attachments';
          archive.append(buffer, { name: `${folder}/${att.name}` });
        } catch (error) {
          console.error(`Error downloading attachment ${att.url}:`, error);
        }
      });

      // Wait for all downloads to complete
      Promise.all(downloadPromises).then(() => {
        archive.finalize();
      }).catch(reject);
    });

    // Create response with ZIP file
    const zipBuffer = Buffer.concat(chunks);
    const sanitizedName = patternSession.name.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `${sanitizedName}-feedback-${new Date().toISOString().slice(0, 10)}.zip`;

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error exporting prompt:', error);
    return NextResponse.json(
      { error: 'Failed to export prompt' },
      { status: 500 }
    );
  }
}

function generatePrompt(session: any): string {
  const isPreRelease = session.feedbackType === 'how-i-do-it';

  let prompt = `# CRITICAL INDICATOR IMPROVEMENT TASK: ${session.patternType.toUpperCase()}\n\n`;

  prompt += `## Session Metadata\n\n`;
  prompt += `- **Name**: ${session.name}\n`;
  prompt += `- **Symbol**: ${session.symbol}\n`;
  prompt += `- **Timeframe**: ${session.timeframe}\n`;
  prompt += `- **Type**: ${isPreRelease ? '🔮 Pre-Release (User Explanation)' : '🔧 Algorithm Correction'}\n`;
  prompt += `- **Expert User**: ${session.createdBy.name || session.createdBy.email}\n`;
  prompt += `- **Date**: ${new Date(session.createdAt).toLocaleDateString()}\n`;
  prompt += `- **Algorithm Version**: ${session.patternVersion}\n\n`;

  if (session.description) {
    prompt += `## User's Description\n\n${session.description}\n\n`;
  }

  prompt += `---\n\n`;

  // Different intro based on type
  if (isPreRelease) {
    prompt += `## 🎯 MISSION: IMPLEMENT NEW INDICATOR FROM EXPERT EXPLANATION\n\n`;
    prompt += `This is a **pre-release indicator**. An experienced trader is explaining how THEY personally identify ${session.patternType} patterns in their trading. `;
    prompt += `Your task is to deeply understand their methodology and translate it into a robust, accurate detection algorithm.\n\n`;
    prompt += `**User's Trading Approach:**\n\n`;
    prompt += `The user has provided detailed corrections and comments explaining exactly how they spot ${session.patternType} patterns. `;
    prompt += `Study their reasoning, examine the specific price points they marked, and internalize their pattern recognition logic.\n\n`;
  } else {
    prompt += `## 🔧 MISSION: FIX ALGORITHM BUGS BASED ON EXPERT FEEDBACK\n\n`;
    prompt += `The ${session.patternType} detection algorithm (version ${session.patternVersion}) is producing incorrect results. `;
    prompt += `An experienced trader has reviewed real chart data and marked specific issues - false positives, missed detections, incorrect placements.\n\n`;
    prompt += `**Current Algorithm Issues:**\n\n`;
    prompt += `The user has provided ${session.corrections.length} corrections and ${session.comments.length} comments identifying specific failures. `;
    prompt += `Each correction represents a real-world case where the algorithm failed to meet professional trading standards.\n\n`;
  }

  // Corrections with enhanced context
  if (session.corrections.length > 0) {
    prompt += `## 📝 DETAILED CORRECTIONS (${session.corrections.length} Issues Identified)\n\n`;
    prompt += `**IMPORTANT**: Each correction below represents a critical failure in the current implementation. Analyze each one deeply.\n\n`;

    session.corrections.forEach((correction: any, index: number) => {
      prompt += `### Correction #${index + 1}: ${correction.correctionType.toUpperCase()}\n\n`;
      prompt += `**Reported by**: ${correction.user.name || correction.user.email}\n\n`;

      if (correction.correctionType === 'move') {
        prompt += `**Action**: User MOVED a detection point\n`;
        prompt += `- **Wrong Location**: Index ${correction.originalIndex}, Price $${correction.originalPrice}, Time ${new Date(correction.originalTime).toLocaleString()}\n`;
        prompt += `- **Correct Location**: Index ${correction.correctedIndex}, Price $${correction.correctedPrice}, Time ${new Date(correction.correctedTime).toLocaleString()}\n`;
        prompt += `- **Shift**: ${Math.abs(correction.correctedIndex - correction.originalIndex)} candles, $${Math.abs(correction.correctedPrice - correction.originalPrice).toFixed(2)} difference\n\n`;
      } else if (correction.correctionType === 'add') {
        prompt += `**Action**: User ADDED a missing detection (algorithm failed to detect this)\n`;
        prompt += `- **Location**: Index ${correction.correctedIndex}, Price $${correction.correctedPrice}, Time ${new Date(correction.correctedTime).toLocaleString()}\n`;
        prompt += `- **Type**: ${correction.correctedType || 'N/A'}\n`;
        prompt += `- **Structure**: ${correction.correctedStructure || 'N/A'}\n\n`;
      } else if (correction.correctionType === 'delete') {
        prompt += `**Action**: User DELETED a false positive (algorithm detected something that isn't there)\n`;
        prompt += `- **False Detection**: Index ${correction.originalIndex}, Price $${correction.originalPrice}, Time ${new Date(correction.originalTime).toLocaleString()}\n`;
        prompt += `- **Type**: ${correction.originalType || 'N/A'}\n\n`;
      } else if (correction.correctionType === 'confirm') {
        prompt += `**Action**: User CONFIRMED this detection is CORRECT\n`;
        prompt += `- **Confirmed**: Index ${correction.originalIndex}, Price $${correction.originalPrice}\n\n`;
      }

      prompt += `**User's Reasoning**:\n> ${correction.reason}\n\n`;

      if (correction.attachments && Array.isArray(correction.attachments) && correction.attachments.length > 0) {
        prompt += `**Visual Evidence** (screenshots/charts):\n`;
        correction.attachments.forEach((att: any) => {
          prompt += `- [${att.name || att.fileName}](${att.url}) - EXAMINE THIS CAREFULLY\n`;
        });
        prompt += `\n`;
      }

      prompt += `---\n\n`;
    });
  }

  // Comments with enhanced context
  if (session.comments.length > 0) {
    prompt += `## 💬 ADDITIONAL INSIGHTS (${session.comments.length} Comments)\n\n`;
    prompt += `The user provided these general comments about the indicator's behavior:\n\n`;

    session.comments.forEach((comment: any, index: number) => {
      prompt += `### Comment #${index + 1} by ${comment.user.name || comment.user.email}\n\n`;
      prompt += `${comment.content}\n\n`;

      if (comment.candleTime) {
        prompt += `**Referenced Time**: ${new Date(comment.candleTime).toLocaleString()}\n`;
        prompt += `**Canvas Position**: (${comment.canvasX?.toFixed(0) || 'N/A'}, ${comment.canvasY?.toFixed(0) || 'N/A'})\n\n`;
      }

      if (comment.attachments && Array.isArray(comment.attachments) && comment.attachments.length > 0) {
        prompt += `**Attachments**:\n`;
        comment.attachments.forEach((att: any) => {
          prompt += `- [${att.name || att.fileName}](${att.url})\n`;
        });
        prompt += `\n`;
      }

      prompt += `---\n\n`;
    });
  }

  // Detection summary with analysis prompts
  if (session.detections.length > 0) {
    prompt += `## 📊 ALGORITHM'S CURRENT DETECTIONS\n\n`;
    prompt += `The algorithm currently detected ${session.detections.length} total points. Here's the breakdown:\n\n`;

    const detectionTypes: Record<string, number> = {};
    const detectionsByStatus: Record<string, number> = {};

    session.detections.forEach((detection: any) => {
      detectionTypes[detection.detectionType] = (detectionTypes[detection.detectionType] || 0) + 1;
      detectionsByStatus[detection.status] = (detectionsByStatus[detection.status] || 0) + 1;
    });

    prompt += `**By Type:**\n`;
    Object.entries(detectionTypes).forEach(([type, count]) => {
      prompt += `- ${type}: ${count}\n`;
    });

    prompt += `\n**By Status:**\n`;
    Object.entries(detectionsByStatus).forEach(([status, count]) => {
      prompt += `- ${status}: ${count}\n`;
    });

    prompt += `\n**The full detection data is in the JSON export** - use it to see exact coordinates, timestamps, and metadata.\n\n`;
  }

  // The actual task with MAXIMUM THINKING PROMPTS
  prompt += `---\n\n`;
  prompt += `## 🧠 YOUR TASK: DEEP ANALYSIS & IMPLEMENTATION\n\n`;

  prompt += `**CRITICAL INSTRUCTIONS - READ CAREFULLY:**\n\n`;

  prompt += `### Phase 1: RESEARCH & UNDERSTAND\n\n`;
  prompt += `1. **Examine** the JSON export file thoroughly - load it, parse it, understand the data structure\n`;
  prompt += `2. **Study** every correction and comment - what patterns do you see? What's the user really saying?\n`;
  prompt += `3. **Analyze** the price action at each marked point - look at the candles, wicks, volume, context\n`;
  prompt += `4. **Research** trading literature on ${session.patternType} if needed - what are the standard rules?\n`;
  prompt += `5. **Investigate** the current codebase - find the existing ${session.patternType} detection logic\n`;
  prompt += `6. **Compare** the algorithm's output vs. the user's corrections - where's the gap?\n`;
  prompt += `7. **Identify** the root causes - is it thresholds? Logic errors? Missing conditions?\n\n`;

  prompt += `### Phase 2: THINK & BRAINSTORM\n\n`;
  prompt += `1. **Brainstorm** multiple approaches to fix each issue - don't settle for the first idea\n`;
  prompt += `2. **Consider** edge cases - what about wicks vs closes? Higher timeframes? Volatile markets?\n`;
  prompt += `3. **Think** about false positives vs false negatives - which is worse for a trader?\n`;
  prompt += `4. **Evaluate** tradeoffs - accuracy vs speed, complexity vs maintainability\n`;
  prompt += `5. **Question** assumptions - maybe the current approach is fundamentally wrong?\n`;
  prompt += `6. **Visualize** the price action - imagine the chart, the swings, the structure\n`;
  prompt += `7. **Synthesize** all corrections into core principles - what's the underlying pattern?\n\n`;

  prompt += `### Phase 3: PLAN & DESIGN\n\n`;
  prompt += `1. **Design** the improved algorithm - what's the new detection logic?\n`;
  prompt += `2. **Specify** exact conditions - be precise (e.g., "wick must extend >2% beyond close")\n`;
  prompt += `3. **Plan** the implementation - which files to change, which functions to update\n`;
  prompt += `4. **Define** test cases - based on the corrections, what should pass/fail?\n`;
  prompt += `5. **Anticipate** problems - where might this break? What needs error handling?\n`;
  prompt += `6. **Optimize** for correctness first, then performance\n`;
  prompt += `7. **Document** your reasoning - why these changes fix the issues\n\n`;

  prompt += `### Phase 4: IMPLEMENT & VERIFY\n\n`;
  prompt += `1. **Implement** the solution - write clean, well-commented code\n`;
  prompt += `2. **Test** against every correction - does it now detect correctly?\n`;
  prompt += `3. **Verify** on the original data - run the new algorithm on the session's candles\n`;
  prompt += `4. **Compare** outputs - old vs new detections\n`;
  prompt += `5. **Validate** edge cases - try different market conditions\n`;
  prompt += `6. **Review** the code - is it maintainable? Understandable?\n`;
  prompt += `7. **Confirm** all issues are resolved\n\n`;

  // Specific task based on type
  if (isPreRelease) {
    prompt += `### 🎯 SPECIFIC TASK FOR PRE-RELEASE:\n\n`;
    prompt += `This user is teaching you how THEY spot ${session.patternType} patterns. Your job:\n`;
    prompt += `- Extract their methodology from the corrections and comments\n`;
    prompt += `- Understand their decision-making process (why did they mark THIS candle?)\n`;
    prompt += `- Translate their intuitive pattern recognition into algorithmic rules\n`;
    prompt += `- Create a detection function that mimics their expert eye\n`;
    prompt += `- Test it on their examples - if they marked 10 points, your algo should find those same 10\n\n`;
  } else {
    prompt += `### 🔧 SPECIFIC TASK FOR ALGORITHM FIX:\n\n`;
    prompt += `The current ${session.patternType} algorithm has bugs. Your job:\n`;
    prompt += `- Fix every issue identified in the corrections\n`;
    prompt += `- Understand WHY the algorithm failed in each case\n`;
    prompt += `- Update the detection logic to handle these scenarios correctly\n`;
    prompt += `- Preserve correct behavior (don't break confirmed detections)\n`;
    prompt += `- Test thoroughly - run on the session data and verify all corrections are addressed\n\n`;
  }

  prompt += `## 🔥 USE YOUR FULL POWER\n\n`;
  prompt += `This is a critical task for a real trading system. **Use ALL available tools**:\n`;
  prompt += `- File search to find relevant code\n`;
  prompt += `- Code analysis to understand current logic\n`;
  prompt += `- External research if needed (trading concepts, math)\n`;
  prompt += `- Multiple iterations - don't rush, think deeply\n`;
  prompt += `- Ask yourself "is this production-ready?"\n\n`;

  prompt += `**Remember**: A trader's money is on the line. Precision matters. Edge cases matter. Get it RIGHT.\n\n`;

  prompt += `## 📦 DATA AVAILABLE TO YOU\n\n`;
  prompt += `The JSON export contains:\n`;
  prompt += `- Full candle data (OHLCV) for the entire session\n`;
  prompt += `- All original detections with exact coordinates\n`;
  prompt += `- Complete correction details\n`;
  prompt += `- All comments and attachments\n`;
  prompt += `- Session metadata\n\n`;

  prompt += `Load it, parse it, use it. The data is your ground truth.\n\n`;

  prompt += `---\n\n`;
  prompt += `**GO. RESEARCH. THINK. ANALYZE. DESIGN. IMPLEMENT. TEST. VERIFY. DELIVER EXCELLENCE.**\n`;

  return prompt;
}
