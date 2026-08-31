import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../modules/users/entities/user.entity.js';
import * as dotenv from 'dotenv';
dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/construction_db',
  entities: [User], // We only need User entity for this script
  synchronize: false,
});

async function run() {
  await AppDataSource.initialize();
  console.log('Database connected.');

  const userRepository = AppDataSource.getRepository(User);

  const roles = [
    'admin',
    'job_seeker',
    'company',
    'contractor',
    'site_engineer',
  ];
  const passwordHash = await bcrypt.hash('password123', 10);

  console.log('Seeding users...');
  for (const role of roles) {
    const email = `${role}@infyle.com`;
    let user = await userRepository.findOne({ where: { email } });
    if (!user) {
      user = userRepository.create({
        fullName: `${role.replace('_', ' ').toUpperCase()} User`,
        email,
        phone: `123456789${roles.indexOf(role)}`,
        passwordHash,
        role,
      });
      await userRepository.save(user);
      console.log(`Created user: ${email} with role: ${role}`);
    } else {
      console.log(`User ${email} already exists.`);
    }
  }

  console.log('Seeding completed.');
  await AppDataSource.destroy();
}

run().catch((err) => {
  console.error('Error during seeding:', err);
  process.exit(1);
});
