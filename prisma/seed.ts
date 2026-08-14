import { PrismaClient, Role, Semester } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // 1. Create Admin User
  const adminPassword = await bcrypt.hash('SecurePassword123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@webclearance.com' },
    update: {},
    create: {
      email: 'admin@webclearance.com',
      password: adminPassword,
      name: 'System Admin',
      role: Role.ADMIN,
      isEmailVerified: true,
      isActive: true,
    },
  });
  console.log('Admin user created:', admin.email);

  // 2. Create Departments (Central Administrative Units)
  const departmentsData = [
    { name: 'Bursary', code: 'BUR', requiresDocument: true, requiredDocumentDescription: 'School fees receipt' },
    { name: 'ICT', code: 'ICT', requiresDocument: false },
    { name: 'Library', code: 'LIB', requiresDocument: true, requiredDocumentDescription: 'Library clearance slip' },
    { name: 'Student Affairs', code: 'STA', requiresDocument: false },
  ];

  for (const dept of departmentsData) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    });
  }
  console.log('Departments created.');

  // 3. Create Faculties
  const scienceFaculty = await prisma.faculty.upsert({
    where: { code: 'FSC' },
    update: {},
    create: {
      name: 'Faculty of Science',
      code: 'FSC',
      requiresDocument: true,
      requiredDocumentDescription: 'Faculty dues receipt',
    },
  });

  const engineeringFaculty = await prisma.faculty.upsert({
    where: { code: 'ENG' },
    update: {},
    create: {
      name: 'Faculty of Engineering',
      code: 'ENG',
      requiresDocument: true,
      requiredDocumentDescription: 'Engineering society receipt',
    },
  });
  console.log('Faculties created.');

  // 4. Create Programs
  const programsData = [
    { name: 'Computer Science', code: 'CSC', facultyId: scienceFaculty.id },
    { name: 'Software Engineering', code: 'SEN', facultyId: scienceFaculty.id },
    { name: 'Electrical Engineering', code: 'EEE', facultyId: engineeringFaculty.id },
    { name: 'Mechanical Engineering', code: 'MEE', facultyId: engineeringFaculty.id },
  ];

  for (const prog of programsData) {
    await prisma.program.upsert({
      where: { code: prog.code },
      update: {},
      create: prog,
    });
  }
  console.log('Programs created.');

  // 5. Create Academic Sessions
  const session = await prisma.academicSession.upsert({
    where: {
      name_semester: {
        name: '2024/2025',
        semester: Semester.FIRST,
      },
    },
    update: {},
    create: {
      name: '2024/2025',
      semester: Semester.FIRST,
      isActive: true,
    },
  });
  console.log('Academic Session created:', session.name);

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
