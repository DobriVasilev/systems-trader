# CLAUDE CODE IMPLEMENTATION STANDARDS

## 🎯 CORE PRINCIPLE: ULTRA-HIGH QUALITY, NO COMPROMISES

You are implementing critical features for a production trading system where real money is at stake. **Every line of code matters**. Every edge case matters. Every detail matters.

---

## 📋 MANDATORY STANDARDS

### 1. DEEP THINKING REQUIRED

**BEFORE writing ANY code:**

- [ ] Spend 5+ minutes analyzing the problem deeply
- [ ] Consider at least 3 different approaches
- [ ] Think through edge cases systematically
- [ ] Visualize the user's perspective
- [ ] Question every assumption
- [ ] Research if needed - don't guess

**ASK YOURSELF:**
- "What could go wrong?"
- "What am I missing?"
- "Is this the simplest solution?"
- "Would I bet money on this working?"

### 2. INDUSTRY-STANDARD CODE QUALITY

**Code MUST be:**

✅ **Clean** - Self-documenting, clear variable names, logical structure
✅ **Correct** - Handles all cases, no subtle bugs, tested thoroughly
✅ **Complete** - No TODOs, no placeholders, no "good enough"
✅ **Consistent** - Matches existing code style perfectly
✅ **Commented** - Complex logic explained, edge cases documented

**NEVER:**
- ❌ Cut corners to save time
- ❌ Leave placeholder comments like "// TODO: handle error"
- ❌ Skip edge case handling "because it's rare"
- ❌ Copy-paste without understanding
- ❌ Ship code you wouldn't be proud of

### 3. SYSTEMATIC APPROACH

**Follow this process EVERY TIME:**

1. **RESEARCH** (15-20% of time)
   - Read all relevant code
   - Understand existing patterns
   - Check similar implementations
   - Review related issues

2. **THINK** (20-25% of time)
   - Brainstorm multiple solutions
   - Consider tradeoffs carefully
   - Think through edge cases
   - Design the approach

3. **IMPLEMENT** (30-40% of time)
   - Write clean, tested code
   - Handle errors properly
   - Add meaningful comments
   - Follow conventions

4. **VERIFY** (20-25% of time)
   - Test the happy path
   - Test edge cases
   - Test error scenarios
   - Review your own code critically

### 4. ERROR HANDLING & VALIDATION

**ALWAYS:**
- Validate ALL user inputs
- Handle network failures gracefully
- Provide helpful error messages
- Log errors with context
- Never swallow errors silently
- Consider what happens when services are down

**NEVER:**
- Assume inputs are valid
- Let unhandled errors crash the app
- Show technical errors to users
- Skip validation "just this once"

### 5. PERFORMANCE & SCALABILITY

**Consider:**
- Will this work with 1000x the data?
- Are there N+1 queries?
- Is this approach efficient?
- Are we caching appropriately?
- Could this block the UI?

**Optimize for:**
- Correctness FIRST
- Maintainability SECOND
- Performance THIRD

### 6. SECURITY

**CRITICAL:**
- Sanitize ALL user inputs
- Use parameterized queries (prevent SQL injection)
- Escape HTML output (prevent XSS)
- Validate file uploads
- Check permissions properly
- Never trust client-side data
- Rate limit where needed

### 7. USER EXPERIENCE

**Think like a user:**
- Is this intuitive?
- Is feedback immediate?
- Are errors helpful?
- Is loading state clear?
- Does it work on mobile?
- Is it accessible?

**Provide:**
- Loading states for async operations
- Success/error feedback
- Clear instructions
- Keyboard shortcuts
- Responsive design

### 8. TESTING MINDSET

**Before committing, verify:**
- Happy path works
- Edge cases handled
- Errors handled gracefully
- No console errors
- No TypeScript errors
- Build succeeds
- Existing tests pass

**Test scenarios:**
- Empty data
- Maximum data
- Invalid data
- Network failures
- Race conditions
- Concurrent operations

### 9. DOCUMENTATION

**Comment when:**
- Logic is non-obvious
- Edge cases are handled
- Performance tradeoffs were made
- Future maintainers might be confused

**Don't comment:**
- Obvious code (`// increment counter`)
- What code does (code should be self-documenting)

**DO explain:**
- WHY you chose this approach
- WHAT edge cases are handled
- HOW complex algorithms work

### 10. PRODUCTION READINESS

**Code is ready when:**
- ✅ All requirements met
- ✅ All edge cases handled
- ✅ All errors handled
- ✅ Fully tested
- ✅ Properly typed (TypeScript)
- ✅ No console.logs left behind
- ✅ No commented-out code
- ✅ Follows existing patterns
- ✅ You'd use it yourself
- ✅ You'd be proud to show it

---

## 🚫 ABSOLUTE NO-NOS

**NEVER do these things:**

1. **Ship incomplete features** - Finish what you start
2. **Leave TODOs in production** - Complete it now
3. **Ignore user feedback** - They're using the system
4. **Break existing functionality** - Test before committing
5. **Skip error handling** - Plan for failure
6. **Write sloppy code** - Quality always
7. **Guess instead of research** - Knowledge beats guessing
8. **Assume edge cases won't happen** - They will
9. **Trust without verifying** - Test everything
10. **Settle for "good enough"** - Excellence is the standard

---

## 💪 MINDSET

**Remember:**

- You're building a **professional trading system**
- **Real traders** will use this
- **Real money** is on the line
- Your code represents **your craftsmanship**
- Do it **right**, not just fast
- Be **thorough**, not rushed
- **Excellence** is not optional

**When in doubt:**
- Research more
- Think deeper
- Test harder
- Question assumptions
- Ask for clarification
- Take the extra time

---

## 🎯 FINAL CHECKLIST

Before marking ANY task complete, verify:

- [ ] Deep analysis completed
- [ ] Best approach chosen
- [ ] Code is production-ready
- [ ] All edge cases handled
- [ ] All errors handled
- [ ] Fully tested
- [ ] Properly documented
- [ ] Follows existing patterns
- [ ] No shortcuts taken
- [ ] You're genuinely proud of it

---

## 🔥 EXCELLENCE, ALWAYS

**This is not just code. This is craftsmanship.**

Every feature you build, every bug you fix, every line you write - it all matters.

**Treat this codebase like a work of art.**

**Deliver excellence. Always.**
