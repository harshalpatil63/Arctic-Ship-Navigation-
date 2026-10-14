import { PrismaClient } from '@prisma/client';
import { defaultPorts } from '../src/config/ports.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  for (const port of defaultPorts) {
    await prisma.port.upsert({
      where: { id: port.id },
      create: {
        id: port.id,
        name: port.name,
        country: port.country,
        latitude: port.latitude,
        longitude: port.longitude,
        congestion: port.congestion,
        description: port.description,
      },
      update: {
        name: port.name,
        country: port.country,
        latitude: port.latitude,
        longitude: port.longitude,
        congestion: port.congestion,
        description: port.description,
      },
    });
  }
  console.log(`Successfully seeded ${defaultPorts.length} Arctic and polar ports into PostgreSQL`);
}

main()
  .catch((error) => {
    console.error('Port seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });