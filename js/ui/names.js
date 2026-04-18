import { seededRand } from '../game/rng.js';

const SKEWRD_ADJ = [
  'Velvet', 'Cobalt', 'Gilded', 'Crimson', 'Sullen', 'Amber', 'Hollow', 'Frosted', 'Brazen', 'Spectral',
  'Murky', 'Verdant', 'Ashen', 'Bronzed', 'Nimble', 'Stormy', 'Wistful', 'Pallid', 'Gilded', 'Onyx',
  'Russet', 'Solemn', 'Twilight', 'Brindled', 'Pewter',
];
const SKEWRD_ANI = [
  'Penguin', 'Mongoose', 'Macaw', 'Viper', 'Wombat', 'Salamander', 'Lynx', 'Narwhal', 'Capybara', 'Marmot',
  'Pelican', 'Jackal', 'Okapi', 'Puffin', 'Tapir', 'Caracal', 'Numbat', 'Quetzal', 'Axolotl', 'Pangolin',
  'Ibis', 'Mandrill', 'Vole', 'Ocelot', 'Raven',
];

export function getDailyName() {
  const day = Math.floor(Date.now() / 86400000);
  const rand1 = seededRand(day * 1234567891);
  const rand2 = seededRand(day * 9876543211);
  const adj = SKEWRD_ADJ[Math.floor(rand1() * SKEWRD_ADJ.length)];
  const ani = SKEWRD_ANI[Math.floor(rand2() * SKEWRD_ANI.length)];
  return 'The ' + adj + ' ' + ani;
}
