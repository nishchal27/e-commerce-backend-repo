/**
 * Warehouses Service
 *
 * This service contains the business logic for warehouse operations.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { WarehousesRepository } from './warehouses.repository';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehouseResponseDto } from './dto/warehouse-response.dto';
import { Logger } from '../../lib/logger';

/**
 * WarehousesService handles business logic for warehouse operations
 */
@Injectable()
export class WarehousesService {
  constructor(
    private readonly warehousesRepository: WarehousesRepository,
    private readonly logger: Logger,
  ) {}

  /**
   * Get all warehouses.
   *
   * @param includeInactive - Whether to include inactive warehouses
   * @returns Array of warehouses
   */
  async findAll(includeInactive: boolean = false): Promise<WarehouseResponseDto[]> {
    return this.warehousesRepository.findAll(includeInactive);
  }

  /**
   * Get a single warehouse by ID.
   *
   * @param id - Warehouse UUID
   * @returns Warehouse
   * @throws NotFoundException if warehouse not found
   */
  async findOne(id: string): Promise<WarehouseResponseDto> {
    const warehouse = await this.warehousesRepository.findById(id);

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }

    return warehouse;
  }

  /**
   * Get a warehouse by code.
   *
   * @param code - Warehouse code
   * @returns Warehouse
   * @throws NotFoundException if warehouse not found
   */
  async findByCode(code: string): Promise<WarehouseResponseDto> {
    const warehouse = await this.warehousesRepository.findByCode(code);

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with code ${code} not found`);
    }

    return warehouse;
  }

  /**
   * Create a new warehouse.
   *
   * @param createWarehouseDto - Warehouse creation data
   * @returns Created warehouse
   * @throws BadRequestException if code already exists
   */
  async create(createWarehouseDto: CreateWarehouseDto): Promise<WarehouseResponseDto> {
    // Validate code uniqueness
    const existing = await this.warehousesRepository.findByCode(createWarehouseDto.code);
    if (existing) {
      throw new BadRequestException(`Warehouse with code ${createWarehouseDto.code} already exists`);
    }

    const warehouse = await this.warehousesRepository.create(createWarehouseDto);
    this.logger.log(`Warehouse created: ${warehouse.id} (${warehouse.code})`, 'WarehousesService');

    return warehouse;
  }

  /**
   * Update an existing warehouse.
   *
   * @param id - Warehouse UUID
   * @param updateWarehouseDto - Warehouse update data
   * @returns Updated warehouse
   * @throws NotFoundException if warehouse not found
   * @throws BadRequestException if code already exists
   */
  async update(id: string, updateWarehouseDto: UpdateWarehouseDto): Promise<WarehouseResponseDto> {
    const existing = await this.warehousesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }

    // Validate code uniqueness if being updated
    if (updateWarehouseDto.code && updateWarehouseDto.code !== existing.code) {
      const codeExists = await this.warehousesRepository.findByCode(updateWarehouseDto.code);
      if (codeExists) {
        throw new BadRequestException(`Warehouse with code ${updateWarehouseDto.code} already exists`);
      }
    }

    const warehouse = await this.warehousesRepository.update(id, updateWarehouseDto);
    this.logger.log(`Warehouse updated: ${warehouse.id}`, 'WarehousesService');

    return warehouse;
  }

  /**
   * Delete a warehouse (soft delete).
   *
   * @param id - Warehouse UUID
   * @throws NotFoundException if warehouse not found
   */
  async remove(id: string): Promise<void> {
    const existing = await this.warehousesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }

    await this.warehousesRepository.delete(id);
    this.logger.log(`Warehouse deleted: ${id}`, 'WarehousesService');
  }
}

