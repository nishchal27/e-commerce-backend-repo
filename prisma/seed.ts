/**
 * Prisma Seed Script
 *
 * This script populates the database with initial data for development and testing.
 * Run with: npm run prisma:seed
 *
 * Seeds:
 * - Sample users (customer and admin)
 * - Sample products with variants
 * - Sample reviews
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Main seed function
 */
async function main() {
  console.log('Starting database seed...');

  // Seed users
  console.log('Seeding users...');
  const hashedPassword = await bcrypt.hash('password123', 10);

  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      password: hashedPassword,
      role: 'CUSTOMER',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  console.log('Users seeded:', { customer: customer.email, admin: admin.email });

  // Seed products
  console.log('Seeding products...');

  // Product 1: Wireless Headphones
  const headphones = await prisma.product.upsert({
    where: { slug: 'wireless-headphones' },
    update: {},
    create: {
      slug: 'wireless-headphones',
      title: 'Premium Wireless Headphones',
      description:
        'High-quality wireless headphones with noise cancellation and 30-hour battery life.',
      variants: {
        create: [
          {
            sku: 'WH-BLK-001',
            price: 199.99,
            currency: 'USD',
            attributes: { color: 'Black', weight: '250g' },
            stock: 50,
          },
          {
            sku: 'WH-WHT-001',
            price: 199.99,
            currency: 'USD',
            attributes: { color: 'White', weight: '250g' },
            stock: 30,
          },
        ],
      },
    },
    include: { variants: true },
  });

  // Product 2: Laptop
  const laptop = await prisma.product.upsert({
    where: { slug: 'laptop-pro-15' },
    update: {},
    create: {
      slug: 'laptop-pro-15',
      title: 'Professional Laptop 15"',
      description: 'Powerful laptop with 16GB RAM, 512GB SSD, and Intel i7 processor.',
      variants: {
        create: [
          {
            sku: 'LP-15-16GB-512GB',
            price: 1299.99,
            currency: 'USD',
            attributes: { ram: '16GB', storage: '512GB SSD', processor: 'Intel i7' },
            stock: 20,
          },
          {
            sku: 'LP-15-32GB-1TB',
            price: 1699.99,
            currency: 'USD',
            attributes: { ram: '32GB', storage: '1TB SSD', processor: 'Intel i7' },
            stock: 10,
          },
        ],
      },
    },
    include: { variants: true },
  });

  // Product 3: Smartphone
  const smartphone = await prisma.product.upsert({
    where: { slug: 'smartphone-pro' },
    update: {},
    create: {
      slug: 'smartphone-pro',
      title: 'Smartphone Pro',
      description: 'Latest smartphone with 128GB storage, dual camera, and 5G connectivity.',
      variants: {
        create: [
          {
            sku: 'SP-128GB-BLK',
            price: 899.99,
            currency: 'USD',
            attributes: { storage: '128GB', color: 'Black' },
            stock: 100,
          },
          {
            sku: 'SP-256GB-BLK',
            price: 1099.99,
            currency: 'USD',
            attributes: { storage: '256GB', color: 'Black' },
            stock: 75,
          },
          {
            sku: 'SP-128GB-WHT',
            price: 899.99,
            currency: 'USD',
            attributes: { storage: '128GB', color: 'White' },
            stock: 80,
          },
        ],
      },
    },
    include: { variants: true },
  });

  console.log('Products seeded:', {
    headphones: headphones.slug,
    laptop: laptop.slug,
    smartphone: smartphone.slug,
  });

  // Seed reviews
  console.log('Seeding reviews...');

  await prisma.review.createMany({
    data: [
      {
        productId: headphones.id,
        userId: customer.id,
        rating: 5,
        comment: 'Excellent sound quality and battery life!',
      },
      {
        productId: headphones.id,
        userId: customer.id,
        rating: 4,
        comment: 'Great headphones, but a bit expensive.',
      },
      {
        productId: laptop.id,
        userId: customer.id,
        rating: 5,
        comment: 'Perfect for work and gaming. Highly recommend!',
      },
      {
        productId: smartphone.id,
        userId: customer.id,
        rating: 4,
        comment: 'Good phone, fast performance, good camera.',
      },
    ],
    skipDuplicates: true,
  });

  console.log('Reviews seeded');

  console.log('Database seed completed successfully!');
}

// Execute seed function
main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

