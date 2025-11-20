/**
 * Promotions Service
 *
 * This service contains the business logic for promotion operations.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PromotionsRepository } from './promotions.repository';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { ValidatePromotionDto } from './dto/validate-promotion.dto';
import { PromotionResponseDto } from './dto/promotion-response.dto';
import { Logger } from '../../lib/logger';

/**
 * PromotionsService handles business logic for promotion operations
 */
@Injectable()
export class PromotionsService {
  constructor(
    private readonly promotionsRepository: PromotionsRepository,
    private readonly logger: Logger,
  ) {}

  /**
   * Get all promotions.
   *
   * @param includeInactive - Whether to include inactive promotions
   * @param activeOnly - Whether to only return currently active promotions
   * @returns Array of promotions
   */
  async findAll(includeInactive: boolean = false, activeOnly: boolean = false): Promise<PromotionResponseDto[]> {
    const promotions = await this.promotionsRepository.findAll(includeInactive, activeOnly);

    return promotions.map((promo) => {
      const isValid = this.promotionsRepository.isPromotionValid(promo);
      return {
        ...promo,
        value: Number(promo.value),
        minPurchase: promo.minPurchase ? Number(promo.minPurchase) : null,
        maxDiscount: promo.maxDiscount ? Number(promo.maxDiscount) : null,
        applicableCategories: promo.applicableCategories as string[] | null,
        applicableBrands: promo.applicableBrands as string[] | null,
        isValid,
      };
    });
  }

  /**
   * Get a single promotion by ID.
   *
   * @param id - Promotion UUID
   * @returns Promotion
   * @throws NotFoundException if promotion not found
   */
  async findOne(id: string): Promise<PromotionResponseDto> {
    const promotion = await this.promotionsRepository.findById(id);

    if (!promotion) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }

    const isValid = this.promotionsRepository.isPromotionValid(promotion);

    return {
      ...promotion,
      value: Number(promotion.value),
      minPurchase: promotion.minPurchase ? Number(promotion.minPurchase) : null,
      maxDiscount: promotion.maxDiscount ? Number(promotion.maxDiscount) : null,
      applicableCategories: promotion.applicableCategories as string[] | null,
      applicableBrands: promotion.applicableBrands as string[] | null,
      isValid,
    };
  }

  /**
   * Get a promotion by code.
   *
   * @param code - Promotion code
   * @returns Promotion
   * @throws NotFoundException if promotion not found
   */
  async findByCode(code: string): Promise<PromotionResponseDto> {
    const promotion = await this.promotionsRepository.findByCode(code);

    if (!promotion) {
      throw new NotFoundException(`Promotion with code ${code} not found`);
    }

    const isValid = this.promotionsRepository.isPromotionValid(promotion);

    return {
      ...promotion,
      value: Number(promotion.value),
      minPurchase: promotion.minPurchase ? Number(promotion.minPurchase) : null,
      maxDiscount: promotion.maxDiscount ? Number(promotion.maxDiscount) : null,
      applicableCategories: promotion.applicableCategories as string[] | null,
      applicableBrands: promotion.applicableBrands as string[] | null,
      isValid,
    };
  }

  /**
   * Validate and calculate discount for a promotion code.
   *
   * @param validateDto - Validation data
   * @returns Promotion with calculated discount
   * @throws NotFoundException if promotion not found
   * @throws BadRequestException if promotion is invalid or not applicable
   */
  async validatePromotion(validateDto: ValidatePromotionDto): Promise<PromotionResponseDto> {
    const promotion = await this.promotionsRepository.findByCode(validateDto.code);

    if (!promotion) {
      throw new NotFoundException(`Promotion with code ${validateDto.code} not found`);
    }

    // Check if promotion is valid
    if (!this.promotionsRepository.isPromotionValid(promotion)) {
      throw new BadRequestException(`Promotion ${validateDto.code} is not currently valid`);
    }

    // Check category applicability
    if (promotion.applicableCategories && validateDto.categoryId) {
      const categories = promotion.applicableCategories as string[];
      if (!categories.includes(validateDto.categoryId)) {
        throw new BadRequestException(`Promotion ${validateDto.code} does not apply to this category`);
      }
    }

    // Check brand applicability
    if (promotion.applicableBrands && validateDto.brandId) {
      const brands = promotion.applicableBrands as string[];
      if (!brands.includes(validateDto.brandId)) {
        throw new BadRequestException(`Promotion ${validateDto.code} does not apply to this brand`);
      }
    }

    // Check minimum purchase
    if (promotion.minPurchase && validateDto.orderAmount) {
      if (validateDto.orderAmount < Number(promotion.minPurchase)) {
        throw new BadRequestException(
          `Order amount must be at least ${promotion.minPurchase} to use this promotion`,
        );
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (validateDto.orderAmount) {
      if (promotion.type === 'percentage') {
        discountAmount = (validateDto.orderAmount * Number(promotion.value)) / 100;
        // Apply max discount cap if specified
        if (promotion.maxDiscount && discountAmount > Number(promotion.maxDiscount)) {
          discountAmount = Number(promotion.maxDiscount);
        }
      } else if (promotion.type === 'fixed_amount') {
        discountAmount = Number(promotion.value);
        // Don't exceed order amount
        if (discountAmount > validateDto.orderAmount) {
          discountAmount = validateDto.orderAmount;
        }
      } else if (promotion.type === 'free_shipping') {
        // Free shipping - discount amount would be shipping cost (calculated elsewhere)
        discountAmount = 0; // Shipping cost calculated separately
      }
    }

    return {
      ...promotion,
      value: Number(promotion.value),
      minPurchase: promotion.minPurchase ? Number(promotion.minPurchase) : null,
      maxDiscount: promotion.maxDiscount ? Number(promotion.maxDiscount) : null,
      applicableCategories: promotion.applicableCategories as string[] | null,
      applicableBrands: promotion.applicableBrands as string[] | null,
      isValid: true,
      discountAmount,
    };
  }

  /**
   * Create a new promotion.
   *
   * @param createPromotionDto - Promotion creation data
   * @returns Created promotion
   * @throws BadRequestException if code already exists or date range is invalid
   */
  async create(createPromotionDto: CreatePromotionDto): Promise<PromotionResponseDto> {
    // Validate code uniqueness
    const existing = await this.promotionsRepository.findByCode(createPromotionDto.code);
    if (existing) {
      throw new BadRequestException(`Promotion with code ${createPromotionDto.code} already exists`);
    }

    // Validate date range
    const startDate = new Date(createPromotionDto.startDate);
    const endDate = new Date(createPromotionDto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Validate promotion type and value
    if (createPromotionDto.type === 'percentage' && createPromotionDto.value > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }

    const promotion = await this.promotionsRepository.create(createPromotionDto);
    this.logger.log(`Promotion created: ${promotion.id} (${promotion.code})`, 'PromotionsService');

    const isValid = this.promotionsRepository.isPromotionValid(promotion);

    return {
      ...promotion,
      value: Number(promotion.value),
      minPurchase: promotion.minPurchase ? Number(promotion.minPurchase) : null,
      maxDiscount: promotion.maxDiscount ? Number(promotion.maxDiscount) : null,
      applicableCategories: promotion.applicableCategories as string[] | null,
      applicableBrands: promotion.applicableBrands as string[] | null,
      isValid,
    };
  }

  /**
   * Update an existing promotion.
   *
   * @param id - Promotion UUID
   * @param updatePromotionDto - Promotion update data
   * @returns Updated promotion
   * @throws NotFoundException if promotion not found
   * @throws BadRequestException if code already exists or date range is invalid
   */
  async update(id: string, updatePromotionDto: UpdatePromotionDto): Promise<PromotionResponseDto> {
    const existing = await this.promotionsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }

    // Validate code uniqueness if being updated
    if (updatePromotionDto.code && updatePromotionDto.code.toUpperCase() !== existing.code) {
      const codeExists = await this.promotionsRepository.findByCode(updatePromotionDto.code);
      if (codeExists) {
        throw new BadRequestException(`Promotion with code ${updatePromotionDto.code} already exists`);
      }
    }

    // Validate date range
    const startDate = updatePromotionDto.startDate ? new Date(updatePromotionDto.startDate) : existing.startDate;
    const endDate = updatePromotionDto.endDate ? new Date(updatePromotionDto.endDate) : existing.endDate;

    if (startDate >= endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Validate promotion type and value
    const type = updatePromotionDto.type || existing.type;
    const value = updatePromotionDto.value !== undefined ? updatePromotionDto.value : Number(existing.value);
    if (type === 'percentage' && value > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }

    const promotion = await this.promotionsRepository.update(id, updatePromotionDto);
    this.logger.log(`Promotion updated: ${promotion.id}`, 'PromotionsService');

    const isValid = this.promotionsRepository.isPromotionValid(promotion);

    return {
      ...promotion,
      value: Number(promotion.value),
      minPurchase: promotion.minPurchase ? Number(promotion.minPurchase) : null,
      maxDiscount: promotion.maxDiscount ? Number(promotion.maxDiscount) : null,
      applicableCategories: promotion.applicableCategories as string[] | null,
      applicableBrands: promotion.applicableBrands as string[] | null,
      isValid,
    };
  }

  /**
   * Delete a promotion (soft delete).
   *
   * @param id - Promotion UUID
   * @throws NotFoundException if promotion not found
   */
  async remove(id: string): Promise<void> {
    const existing = await this.promotionsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }

    await this.promotionsRepository.delete(id);
    this.logger.log(`Promotion deleted: ${id}`, 'PromotionsService');
  }

  /**
   * Record promotion usage (increment usage count).
   * Called when a promotion is successfully applied to an order.
   *
   * @param code - Promotion code
   * @throws NotFoundException if promotion not found
   */
  async recordUsage(code: string): Promise<void> {
    const promotion = await this.promotionsRepository.findByCode(code);
    if (!promotion) {
      throw new NotFoundException(`Promotion with code ${code} not found`);
    }

    await this.promotionsRepository.incrementUsage(promotion.id);
    this.logger.debug(`Promotion usage recorded: ${code}`, 'PromotionsService');
  }
}

