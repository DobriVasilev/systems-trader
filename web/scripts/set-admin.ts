import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find user by email
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  console.log("Current users:");
  users.forEach((user) => {
    console.log(`- ${user.name || "No name"} (${user.email}): ${user.role}`);
  });

  // Update Dobri's role to admin
  const dobriUser = users.find(
    (u) => u.email.includes("dobri") || u.name?.toLowerCase().includes("dobri")
  );

  if (dobriUser) {
    console.log(`\nUpdating ${dobriUser.email} to admin role...`);
    await prisma.user.update({
      where: { id: dobriUser.id },
      data: { role: "admin" },
    });
    console.log("✓ Role updated to admin");
  } else {
    console.log("\nNo user matching 'dobri' found");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
