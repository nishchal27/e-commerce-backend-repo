/**
 * Suppliers Service
 *
 * This service contains the business logic for supplier and product cost operations.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SuppliersRepository } from './suppliers.repository';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateProductCostDto } from './dto/create-product-cost.dto';
import { SupplierResponseDto, ProductCostResponseDto } from './dto/supplier-response.dto';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { Logger } from '../../lib/logger';

/**
 * SuppliersService handles business logic for supplier operations
 */
@Injectable()
export class SuppliersService {
  constructor(
    private readonly suppliersRepository: SuppliersRepository,
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  /**
   * Get all suppliers.
   *
   * @param includeInactive - Whether to include inactive suppliers
   * @returns Array of suppliers
   */
  async findAll(includeInactive: boolean = false): Promise<SupplierResponseDto[]> {
    const suppliers = await this.suppliersRepository.findAll(includeInactive);

    return Promise.all(
      suppliers.map(async (supplier) => {
        const productCount = await this.suppliersRepository.getProductCount(supplier.id);
        return {
          ...supplier,
          productCount,
        };
      }),
    );
  }

  /**
   * Get a single supplier by ID.
   *
   * @param id - Supplier UUID
   * @returns Supplier
   * @throws NotFoundException if supplier not found
   */
  async findOne(id: string): Promise<SupplierResponseDto> {
    const supplier = await this.suppliersRepository.findById(id);

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    const productCount = await this.suppliersRepository.getProductCount(id);

    return {
      ...supplier,
      productCount,
    };
  }

  /**
   * Get a supplier by code.
   *
   * @param code - Supplier code
   * @returns Supplier
   * @throws NotFoundException if supplier not found
   */
  async findByCode(code: string): Promise<SupplierResponseDto> {
    const supplier = await this.suppliersRepository.findByCode(code);

    if (!supplier) {
      throw new NotFoundException(`Supplier with code ${code} not found`);
    }

    const productCount = await this.suppliersRepository.getProductCount(supplier.id);

    return {
      ...supplier,
      productCount,
    };
  }

  /**
   * Create a new supplier.
   *
   * @param createSupplierDto - Supplier creation data
   * @returns Created supplier
   * @throws BadRequestException if code already exists
   */
  async create(createSupplierDto: CreateSupplierDto): Promise<SupplierResponseDto> {
    // Validate code uniqueness
    const existing = await this.suppliersRepository.findByCode(createSupplierDto.code);
    if (existing) {
      throw new BadRequestException(`Supplier with code ${createSupplierDto.code} already exists`);
    }

    const supplier = await this.suppliersRepository.create(createSupplierDto);
    this.logger.log(`Supplier created: ${supplier.id} (${supplier.code})`, 'SuppliersService');

    const productCount = await this.suppliersRepository.getProductCount(supplier.id);

    return {
      ...supplier,
      productCount,
    };
  }

  /**
   * Update an existing supplier.
   *
   * @param id - Supplier UUID
   * @param updateSupplierDto - Supplier update data
   * @returns Updated supplier
   * @throws NotFoundException if supplier not found
   * @throws BadRequestException if code already exists
   */
  async update(id: string, updateSupplierDto: UpdateSupplierDto): Promise<SupplierResponseDto> {
    const existing = await this.suppliersRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    // Validate code uniqueness if being updated
    if (updateSupplierDto.code && updateSupplierDto.code !== existing.code) {
      const codeExists = await this.suppliersRepository.findByCode(updateSupplierDto.code);
      if (codeExists) {
        throw new BadRequestException(`Supplier with code ${updateSupplierDto.code} already exists`);
      }
    }

    const supplier = await this.suppliersRepository.update(id, updateSupplierDto);
    this.logger.log(`Supplier updated: ${supplier.id}`, 'SuppliersService');

    const productCount = await this.suppliersRepository.getProductCount(supplier.id);

    return {
      ...supplier,
      productCount,
    };
  }

  /**
   * Delete a supplier (soft delete).
   *
   * @param id - Supplier UUID
   * @throws NotFoundException if supplier not found
   */
  async remove(id: string): Promise<void> {
    const existing = await this.suppliersRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    await this.suppliersRepository.delete(id);
    this.logger.log(`Supplier deleted: ${id}`, 'SuppliersService');
  }

  // ========== Product Cost Operations ==========

  /**
   * Get product cost for a variant.
   *
   * @param variantId - Variant UUID
   * @returns Product cost or null if not found
   * @throws NotFoundException if variant not found
   */
  async getProductCost(variantId: string): Promise<ProductCostResponseDto | null> {
    // Verify variant exists
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant with ID ${variantId} not found`);
    }

    return this.suppliersRepository.findProductCostByVariantId(variantId);
  }

  /**
   * Create or update product cost (upsert).
   *
   * @param createDto - Product cost data
   * @returns Created or updated product cost
   * @throws NotFoundException if variant or supplier not found
   */
  async upsertProductCost(createDto: CreateProductCostDto): Promise<ProductCostResponseDto> {
    // Verify variant exists
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: createDto.variantId },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant with ID ${createDto.variantId} not found`);
    }

    // Verify supplier exists if provided
    if (createDto.supplierId) {
      const supplier = await this.suppliersRepository.findById(createDto.supplierId);
      if (!supplier) {
        throw new NotFoundException(`Supplier with ID ${createDto.supplierId} not found`);
      }
    }

    const cost = await this.suppliersRepository.upsertProductCost(createDto);
    this.logger.log(
      `Product cost ${cost.id ? 'updated' : 'created'}: variant ${createDto.variantId}, cost: ${createDto.costPrice}`,
      'SuppliersService',
    );

    return cost;
  }

  /**
   * Delete product cost.
   *
   * @param variantId - Variant UUID
   * @throws NotFoundException if product cost not found
   */
  async deleteProductCost(variantId: string): Promise<void> {
    const existing = await this.suppliersRepository.findProductCostByVariantId(variantId);
    if (!existing) {
      throw new NotFoundException(`Product cost for variant ${variantId} not found`);
    }

    await this.suppliersRepository.deleteProductCost(variantId);
    this.logger.log(`Product cost deleted for variant ${variantId}`, 'SuppliersService');
  }

  /**
   * Calculate margin for a variant.
   * Margin = (selling price - cost price) / selling price * 100
   *
   * @param variantId - Variant UUID
   * @returns Margin percentage or null if cost not available
   */
  async calculateMargin(variantId: string): Promise<{ margin: number; marginPercent: number } | null> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        price: true,
      },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant with ID ${variantId} not found`);
    }

    const cost = await this.suppliersRepository.findProductCostByVariantId(variantId);
    if (!cost) {
      return null;
    }

    const sellingPrice = Number(variant.price);
    const costPrice = Number(cost.costPrice);
    const margin = sellingPrice - costPrice;
    const marginPercent = (margin / sellingPrice) * 100;

    return {
      margin,
      marginPercent,
    };
  }
}

