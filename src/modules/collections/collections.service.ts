/**
 * Collections Service
 *
 * This service contains the business logic for collection operations.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CollectionsRepository } from './collections.repository';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { CollectionResponseDto } from './dto/collection-response.dto';
import { Logger } from '../../lib/logger';

/**
 * CollectionsService handles business logic for collection operations
 */
@Injectable()
export class CollectionsService {
  constructor(
    private readonly collectionsRepository: CollectionsRepository,
    private readonly logger: Logger,
  ) {}

  /**
   * Get all collections.
   *
   * @param includeInactive - Whether to include inactive collections
   * @param activeOnly - Whether to only return currently active collections (within date range)
   * @returns Array of collections
   */
  async findAll(includeInactive: boolean = false, activeOnly: boolean = false): Promise<CollectionResponseDto[]> {
    const collections = await this.collectionsRepository.findAll(includeInactive, activeOnly);

    return Promise.all(
      collections.map(async (collection) => {
        const productCount = await this.collectionsRepository.getProductCount(collection.id);
        const isActiveNow = this.collectionsRepository.isActiveNow(collection);

        return {
          ...collection,
          productCount,
          isActiveNow,
        };
      }),
    );
  }

  /**
   * Get a single collection by ID.
   *
   * @param id - Collection UUID
   * @returns Collection
   * @throws NotFoundException if collection not found
   */
  async findOne(id: string): Promise<CollectionResponseDto> {
    const collection = await this.collectionsRepository.findById(id);

    if (!collection) {
      throw new NotFoundException(`Collection with ID ${id} not found`);
    }

    const productCount = await this.collectionsRepository.getProductCount(id);
    const isActiveNow = this.collectionsRepository.isActiveNow(collection);

    return {
      ...collection,
      productCount,
      isActiveNow,
    };
  }

  /**
   * Get a collection by slug.
   *
   * @param slug - Collection slug
   * @returns Collection
   * @throws NotFoundException if collection not found
   */
  async findBySlug(slug: string): Promise<CollectionResponseDto> {
    const collection = await this.collectionsRepository.findBySlug(slug);

    if (!collection) {
      throw new NotFoundException(`Collection with slug ${slug} not found`);
    }

    const productCount = await this.collectionsRepository.getProductCount(collection.id);
    const isActiveNow = this.collectionsRepository.isActiveNow(collection);

    return {
      ...collection,
      productCount,
      isActiveNow,
    };
  }

  /**
   * Create a new collection.
   *
   * @param createCollectionDto - Collection creation data
   * @returns Created collection
   * @throws BadRequestException if slug already exists or date range is invalid
   */
  async create(createCollectionDto: CreateCollectionDto): Promise<CollectionResponseDto> {
    // Validate slug uniqueness
    const existing = await this.collectionsRepository.findBySlug(createCollectionDto.slug);
    if (existing) {
      throw new BadRequestException(`Collection with slug ${createCollectionDto.slug} already exists`);
    }

    // Validate date range
    if (createCollectionDto.startDate && createCollectionDto.endDate) {
      const startDate = new Date(createCollectionDto.startDate);
      const endDate = new Date(createCollectionDto.endDate);

      if (startDate >= endDate) {
        throw new BadRequestException('Start date must be before end date');
      }
    }

    const collection = await this.collectionsRepository.create(createCollectionDto);
    this.logger.log(`Collection created: ${collection.id} (${collection.slug})`, 'CollectionsService');

    const productCount = await this.collectionsRepository.getProductCount(collection.id);
    const isActiveNow = this.collectionsRepository.isActiveNow(collection);

    return {
      ...collection,
      productCount,
      isActiveNow,
    };
  }

  /**
   * Update an existing collection.
   *
   * @param id - Collection UUID
   * @param updateCollectionDto - Collection update data
   * @returns Updated collection
   * @throws NotFoundException if collection not found
   * @throws BadRequestException if slug already exists or date range is invalid
   */
  async update(id: string, updateCollectionDto: UpdateCollectionDto): Promise<CollectionResponseDto> {
    const existing = await this.collectionsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Collection with ID ${id} not found`);
    }

    // Validate slug uniqueness if being updated
    if (updateCollectionDto.slug && updateCollectionDto.slug !== existing.slug) {
      const slugExists = await this.collectionsRepository.findBySlug(updateCollectionDto.slug);
      if (slugExists) {
        throw new BadRequestException(`Collection with slug ${updateCollectionDto.slug} already exists`);
      }
    }

    // Validate date range
    const startDate = updateCollectionDto.startDate ? new Date(updateCollectionDto.startDate) : existing.startDate;
    const endDate = updateCollectionDto.endDate ? new Date(updateCollectionDto.endDate) : existing.endDate;

    if (startDate && endDate && startDate >= endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    const collection = await this.collectionsRepository.update(id, updateCollectionDto);
    this.logger.log(`Collection updated: ${collection.id}`, 'CollectionsService');

    const productCount = await this.collectionsRepository.getProductCount(collection.id);
    const isActiveNow = this.collectionsRepository.isActiveNow(collection);

    return {
      ...collection,
      productCount,
      isActiveNow,
    };
  }

  /**
   * Delete a collection (soft delete).
   *
   * @param id - Collection UUID
   * @throws NotFoundException if collection not found
   */
  async remove(id: string): Promise<void> {
    const existing = await this.collectionsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Collection with ID ${id} not found`);
    }

    await this.collectionsRepository.delete(id);
    this.logger.log(`Collection deleted: ${id}`, 'CollectionsService');
  }
}

