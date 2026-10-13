// Idempotente opstel-data: skool, eerste administrateur en die 2026-projekte.
// Loop met: npm run seed   (ook veilig om op Railway te herhaal)
//
// Omgewing:
//   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME  – eerste admin (slegs as dit nog nie bestaan nie)
//   SEED_DEMO=1  – skep ook twee toetsgroepe met vaste kodes G8-TEST88 en G9-TEST99 (slegs vir toetsing)
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const db = new PrismaClient();

function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

const school = await db.school.upsert({
  where: { slug: "dirk-postma" },
  create: { slug: "dirk-postma", name: "Gereformeerde Hoërskool Dirk Postma", motto: "Wees sterk en vol moed" },
  update: {}
});
console.log(`[seed] Skool: ${school.name}`);

const email = (process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD || "";
if (email && password) {
  const existing = await db.teacher.findUnique({ where: { email } });
  if (!existing) {
    await db.teacher.create({
      data: { schoolId: school.id, email, name: process.env.SEED_ADMIN_NAME || "Administrateur", role: "ADMIN", passwordHash: hashPassword(password) }
    });
    console.log(`[seed] Admin geskep: ${email}`);
  } else {
    console.log(`[seed] Admin bestaan reeds: ${email}`);
  }
} else {
  console.log("[seed] SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD nie gestel nie – geen admin geskep nie.");
}

const PROJECTS = [
  {
    templateKey: "vol-gr8-natuurbewaring",
    title: "Graad 8 · Natuurbewaring",
    grade: 8,
    phenomenon: "Natuurbewaring",
    question: "Hoe kan ons rentmeesters wees van God se skepping?",
    partner: "Vriende van die Magalies"
  },
  {
    templateKey: "vol-gr9-haweloosheid",
    title: "Graad 9 · Haweloosheid",
    grade: 9,
    phenomenon: "Haweloosheid",
    question: "Hoe kan ons ons verantwoordelikheid teenoor ons naaste uitleef?",
    partner: "Moeggesukkel"
  }
];

const year = 2026;
const made = {};
for (const p of PROJECTS) {
  let project = await db.project.findFirst({ where: { schoolId: school.id, templateKey: p.templateKey, year } });
  if (!project) {
    project = await db.project.create({ data: { schoolId: school.id, year, ...p } });
    console.log(`[seed] Projek geskep: ${p.title} ${year}`);
  }
  made[p.grade] = project;
}

if (process.env.SEED_DEMO === "1") {
  for (const [grade, code] of [
    [8, "G8-TEST88"],
    [9, "G9-TEST99"]
  ]) {
    await db.group.upsert({ where: { code }, create: { code, projectId: made[grade].id, klas: `${grade}T` }, update: {} });
    console.log(`[seed] Toetsgroep: ${code}`);
  }
}

await db.$disconnect();
