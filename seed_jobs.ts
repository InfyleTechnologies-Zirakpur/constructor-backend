import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './src/modules/users/entities/user.entity.js';
import { Company } from './src/modules/companies/entities/company.entity.js';
import { Job } from './src/modules/jobs/entities/job.entity.js';
import bcrypt from 'bcryptjs';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: 'postgres://postgres:postgres@localhost:5432/construtor',
  entities: [User, Company, Job],
  synchronize: false,
});

async function run() {
  await AppDataSource.initialize();
  console.log('Database connected!');

  const userRepo = AppDataSource.getRepository(User);
  const companyRepo = AppDataSource.getRepository(Company);
  const jobRepo = AppDataSource.getRepository(Job);

  // 1. Create a Company User
  let companyUser = await userRepo.findOne({ where: { email: 'company@example.com' } });
  if (!companyUser) {
    const passwordHash = await bcrypt.hash('password123', 10);
    companyUser = userRepo.create({
      fullName: 'Vertex Builders Admin',
      email: 'company@example.com',
      phone: '1112223334',
      passwordHash,
      role: 'company',
    });
    await userRepo.save(companyUser);
    console.log('Created company user');
  }

  // 2. Create a Company Profile
  let company = await companyRepo.findOne({ where: { userId: companyUser.id } });
  if (!company) {
    company = companyRepo.create({
      userId: companyUser.id,
      name: 'Vertex Builders',
      contactEmail: 'contact@vertexbuilders.com',
      contactPhone: '1112223334',
      address: 'Bathinda, Punjab',
      verificationStatus: 'verified',
    });
    await companyRepo.save(company);
    console.log('Created company profile');
  }

  // 3. Create sample Jobs
  const jobs = [
    {
      title: 'Site Electrician',
      location: 'Bathinda, Punjab',
      dailyPay: 850,
      skills: ['Electrician', 'Wiring'],
      description: 'Install, maintain, and repair electrical systems on an active construction site while following site safety procedures.',
      requirements: ['2+ years of electrical work', 'Valid safety training certificate'],
      projectType: 'Full-time',
      experienceLevel: 'Experienced',
      status: 'published',
      companyId: company.id,
    },
    {
      title: 'Expert Mason',
      location: 'Chandigarh',
      dailyPay: 900,
      skills: ['Mason', 'Bricklaying'],
      description: 'Experienced mason needed for commercial building project.',
      requirements: ['3+ years experience'],
      projectType: 'Contract',
      experienceLevel: 'Expert',
      status: 'published',
      companyId: company.id,
    },
    {
      title: 'General Laborer',
      location: 'Ludhiana, Punjab',
      dailyPay: 600,
      skills: ['Laborer', 'Heavy Lifting'],
      description: 'Assist with site cleanup, material transport, and basic tasks.',
      requirements: ['Ability to lift 50lbs', 'Reliable transportation'],
      projectType: 'Temporary',
      experienceLevel: 'Entry-level',
      status: 'published',
      companyId: company.id,
    }
  ];

  for (const job of jobs) {
    const existing = await jobRepo.findOne({ where: { title: job.title, companyId: company.id } });
    if (!existing) {
      const newJob = jobRepo.create(job);
      await jobRepo.save(newJob);
      console.log(`Created job: ${job.title}`);
    }
  }

  console.log('Seeding complete!');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
