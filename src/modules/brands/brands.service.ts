/**
 * Brands Service
 *
 * This service contains the business logic for brand operations.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BrandsRepository } from './brands.repository';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { BrandResponseDto } from './dto/brand-response.dto';
import { Logger } from '../../lib/logger';

/**
 * BrandsService handles business logic for brand operations
 */
@Injectable()
export class BrandsService {
  constructor(
    private readonly brandsRepository: BrandsRepository,
    private readonly logger: Logger,
  ) {}

  /**
   * Get all brands.
   *
   * @param includeInactive - Whether to include inactive brands
   * @returns Array of brands
   */
  async findAll(includeInactive: boolean = false): Promise<BrandResponseDto[]> {
    const brands = await this.brandsRepository.findAll(includeInactive);

    return Promise.all(
      brands.map(async (brand) => {
        const productCount = await this.brandsRepository.getProductCount(brand.id);
        return {
          ...brand,
          productCount,
        };
      }),
    );
  }

  /**
   * Get a single brand by ID.
   *
   * @param id - Brand UUID
   * @returns Brand
   * @throws NotFoundException if brand not found
   */
  async findOne(id: string): Promise<BrandResponseDto> {
    const brand = await this.brandsRepository.findById(id);

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    const productCount = await this.brandsRepository.getProductCount(id);

    return {
      ...brand,
      productCount,
    };
  }

  /**
   * Get a brand by slug.
   *
   * @param slug - Brand slug
   * @returns Brand
   * @throws NotFoundException if brand not found
   */
  async findBySlug(slug: string): Promise<BrandResponseDto> {
    const brand = await this.brandsRepository.findBySlug(slug);

    if (!brand) {
      throw new NotFoundException(`Brand with slug ${slug} not found`);
    }

    const productCount = await this.brandsRepository.getProductCount(brand.id);

    return {
      ...brand,
      productCount,
    };
  }

  /**
   * Create a new brand.
   *
   * @param createBrandDto - Brand creation data
   * @returns Created brand
   * @throws BadRequestException if slug already exists
   */
  async create(createBrandDto: CreateBrandDto): Promise<BrandResponseDto> {
    // Validate slug uniqueness
    const existing = await this.brandsRepository.findBySlug(createBrandDto.slug);
    if (existing) {
      throw new BadRequestException(`Brand with slug ${createBrandDto.slug} already exists`);
    }

    const brand = await this.brandsRepository.create(createBrandDto);
    this.logger.log(`Brand created: ${brand.id} (${brand.slug})`, 'BrandsService');

    const productCount = await this.brandsRepository.getProductCount(brand.id);

    return {
      ...brand,
      productCount,
    };
  }

  /**
   * Update an existing brand.
   *
   * @param id - Brand UUID
   * @param updateBrandDto - Brand update data
   * @returns Updated brand
   * @throws NotFoundException if brand not found
   * @throws BadRequestException if slug already exists
   */
  async update(id: string, updateBrandDto: UpdateBrandDto): Promise<BrandResponseDto> {
    const existing = await this.brandsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    // Validate slug uniqueness if being updated
    if (updateBrandDto.slug && updateBrandDto.slug !== existing.slug) {
      const slugExists = await this.brandsRepository.findBySlug(updateBrandDto.slug);
      if (slugExists) {
        throw new BadRequestException(`Brand with slug ${updateBrandDto.slug} already exists`);
      }
    }

    const brand = await this.brandsRepository.update(id, updateBrandDto);
    this.logger.log(`Brand updated: ${brand.id}`, 'BrandsService');

    const productCount = await this.brandsRepository.getProductCount(brand.id);

    return {
      ...brand,
      productCount,
    };
  }

  /**
   * Delete a brand (soft delete).
   *
   * @param id - Brand UUID
   * @throws NotFoundException if brand not found
   */
  async remove(id: string): Promise<void> {
    const existing = await this.brandsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    await this.brandsRepository.delete(id);
    this.logger.log(`Brand deleted: ${id}`, 'BrandsService');
  }
}

