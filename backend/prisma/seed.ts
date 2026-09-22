import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ports = [
  { id: 'murmansk', name: 'Murmansk', country: 'Russia', latitude: 68.9585, longitude: 33.0827, congestion: 85, description: 'Major Arctic deep-water port with year-round operations.' },
  { id: 'kirkenes', name: 'Kirkenes', country: 'Norway', latitude: 69.7271, longitude: 30.0458, congestion: 42, description: 'Northern Norwegian port serving Barents Sea shipping.' },
  { id: 'tromso', name: 'Tromso', country: 'Norway', latitude: 69.6492, longitude: 18.9553, congestion: 58, description: 'Arctic maritime and research hub in northern Norway.' },
  { id: 'longyearbyen', name: 'Longyearbyen', country: 'Svalbard', latitude: 78.2232, longitude: 15.6267, congestion: 36, description: 'Svalbard gateway supporting research and Arctic logistics.' },
  { id: 'nuuk', name: 'Nuuk', country: 'Greenland', latitude: 64.1835, longitude: -51.7216, congestion: 48, description: 'Greenlandic capital and west-coast maritime hub.' },
  { id: 'reykjavik', name: 'Reykjavik', country: 'Iceland', latitude: 64.1466, longitude: -21.9426, congestion: 64, description: 'Icelandic North Atlantic port and logistics center.' },
  { id: 'churchill', name: 'Churchill', country: 'Canada', latitude: 58.7684, longitude: -94.165, congestion: 28, description: 'Hudson Bay port supporting seasonal Arctic shipping.' },
  { id: 'nome', name: 'Nome', country: 'United States', latitude: 64.5011, longitude: -165.4064, congestion: 24, description: 'Alaskan Bering Strait port and Arctic logistics point.' },
];

async function main(): Promise<void> {
  for (const port of ports) {
    await prisma.port.upsert({ where: { id: port.id }, create: port, update: port });
  }
  console.log(`Seeded ${ports.length} Arctic ports`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });