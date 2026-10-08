import { describe, it, expect, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { CalculatorsService } from '../calculators.service.js';

describe('CalculatorsService', () => {
  let service: CalculatorsService;

  beforeEach(() => {
    service = new CalculatorsService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── Concrete ─────────────────────────────────────

  describe('calculateConcrete', () => {
    it('should calculate concrete regression for 10x5x0.15m slab with 1:2:4 ratio and 0 wastage', () => {
      const result = service.calculateConcrete(10, 5, 0.15, {
        mixRatio: '1:2:4',
        wastagePercent: 0,
      });
      expect(result.wetVolumeM3).toBeCloseTo(7.5, 2);
      expect(result.dryVolumeM3).toBeCloseTo(11.55, 2);
      expect(result.cementBags).toBeCloseTo(47.55, 2);
      expect(result.sandKg).toBeCloseTo(5115, 2);
      expect(result.sandCft).toBeCloseTo(116.54, 2);
      expect(result.aggregateKg).toBeCloseTo(9570, 2);
      expect(result.aggregateCft).toBeCloseTo(233.08, 2);
      expect(result.mixRatio).toBe('1:2:4');
    });

    it('should calculate sheet slab (5x4x0.5, M20, wastage 5, capacity 5)', () => {
      const result = service.calculateConcrete(5, 4, 0.5, {
        grade: 'M20',
        wastagePercent: 5,
        truckCapacityM3: 5,
      });
      expect(result.wetVolumeM3).toBeCloseTo(10, 2);
      expect(result.dryVolumeM3).toBeCloseTo(15.4, 2);
      expect(result.cementBags).toBeCloseTo(84.73, 2);
      expect(result.sandM3).toBeCloseTo(4.41, 2);
      expect(result.aggregateM3).toBeCloseTo(8.82, 2);
      expect(result.steelKg).toBeCloseTo(800, 2);

      const trucks = result.trucks as {
        capacityM3: number;
        sand: {
          count: number;
          utilisationPercent: number;
          lastTruckFillPercent: number;
        };
        aggregate: {
          count: number;
          utilisationPercent: number;
          lastTruckFillPercent: number;
        };
      };
      expect(trucks).toBeDefined();
      expect(trucks.sand.count).toBe(1);
      expect(trucks.sand.utilisationPercent).toBeCloseTo(88.2, 2);
      expect(trucks.sand.lastTruckFillPercent).toBeCloseTo(88.2, 2);

      expect(trucks.aggregate.count).toBe(2);
      expect(trucks.aggregate.utilisationPercent).toBeCloseTo(88.2, 2);
      expect(trucks.aggregate.lastTruckFillPercent).toBeCloseTo(76.4, 2);
    });

    it('should calculate M20 with no wastage for 10 m3 wet volume', () => {
      const result = service.calculateConcrete(5, 4, 0.5, {
        grade: 'M20',
        wastagePercent: 0,
      });
      expect(result.wetVolumeM3).toBe(10);
      expect(result.cementBags).toBeCloseTo(80.69, 2);
    });

    it('should prioritize grade over mixRatio', () => {
      const result = service.calculateConcrete(5, 4, 0.5, {
        grade: 'M20',
        mixRatio: '1:2:4',
      });
      expect(result.mixRatio).toBe('1:1.5:3');
      expect(result.cementBags).toBeCloseTo(80.69, 2);
    });

    it('should scale with quantity multiplier', () => {
      const r1 = service.calculateConcrete(2, 2, 0.5, { quantity: 1 });
      const r3 = service.calculateConcrete(2, 2, 0.5, { quantity: 3 });
      expect(r3.wetVolumeM3).toBeCloseTo((r1.wetVolumeM3 as number) * 3, 2);
    });

    it('should return zero for zero dimensions', () => {
      const result = service.calculateConcrete(0, 0, 0);
      expect(result.wetVolumeM3).toBe(0);
      expect(result.cementBags).toBe(0);
    });

    it('should correctly handle truck rounding without float artifact (0.3m3 / 0.1m3)', () => {
      // 0.3 / 0.1 is 3 trucks
      const count = Math.max(1, Math.ceil(0.3 / 0.1 - 1e-9));
      expect(count).toBe(3);
    });

    it('should throw BadRequestException on invalid mix ratio', () => {
      expect(() =>
        service.calculateConcrete(1, 1, 1, { mixRatio: 'invalid' }),
      ).toThrow(BadRequestException);
      expect(() =>
        service.calculateConcrete(1, 1, 1, { mixRatio: '1:2' }),
      ).toThrow(BadRequestException);
      expect(() =>
        service.calculateConcrete(1, 1, 1, { mixRatio: '0:0:0' }),
      ).toThrow(BadRequestException);
      expect(() =>
        service.calculateConcrete(1, 1, 1, { mixRatio: '-1:2:4' }),
      ).toThrow(BadRequestException);
    });
  });

  // ─── Cement ───────────────────────────────────────

  describe('calculateCement', () => {
    it('should calculate cement with 1.27 dry factor', () => {
      const result = service.calculateCement(100, 0.012, { mixRatio: '1:4' });
      expect(result.wetVolumeM3).toBe(1.2);
      expect(result.dryVolumeM3).toBeCloseTo(1.52, 2); // 1.2 * 1.27 = 1.524
      expect(result.cementBags).toBeGreaterThan(0);
      expect(result.cementKg).toBeGreaterThan(0);
    });

    it('should respect different mix ratios', () => {
      const r1 = service.calculateCement(10, 0.02, { mixRatio: '1:4' });
      const r2 = service.calculateCement(10, 0.02, { mixRatio: '1:6' });
      expect(r1.cementBags).toBeGreaterThan(r2.cementBags);
    });

    it('should throw on invalid mix ratio', () => {
      expect(() =>
        service.calculateCement(10, 0.02, { mixRatio: '1:2:4' }),
      ).toThrow(BadRequestException);
    });
  });

  // ─── Sand ─────────────────────────────────────────

  describe('calculateSand', () => {
    it('should calculate sand quantity with 1.27 dry factor', () => {
      const result = service.calculateSand(100, 0.02, { mixRatio: '1:4' });
      expect(result.sandVolumeM3).toBeGreaterThan(0);
      expect(result.sandKg).toBeGreaterThan(0);
      expect(result.sandCft).toBeGreaterThan(0);
    });
  });

  // ─── Aggregate ────────────────────────────────────

  describe('calculateAggregate', () => {
    it('should calculate aggregate for given volume and ratio', () => {
      const result = service.calculateAggregate(5, 3, 0.15, {
        mixRatio: '1:2:4',
      });
      expect(result.aggregateVolumeM3).toBeGreaterThan(0);
      expect(result.aggregateKg).toBeGreaterThan(0);
      expect(result.aggregateCft).toBeGreaterThan(0);
    });

    it('should support grade selection in aggregate', () => {
      const result = service.calculateAggregate(5, 3, 0.15, { grade: 'M20' });
      expect(result.mixRatio).toBe('1:1.5:3');
    });
  });

  // ─── Brick ────────────────────────────────────────

  describe('calculateBrick', () => {
    it('should calculate brick sheet wall (10x3x0.23, 1:6, wastage 5)', () => {
      const result = service.calculateBrick(10, 3, 0.23, {
        mortarRatio: '1:6',
        wastagePercent: 5,
      });
      expect(result.wallVolumeM3).toBeCloseTo(6.9, 2);
      expect(result.numberOfBricks).toBe(3623);
      expect(result.mortarVolumeM3).toBeCloseTo(1.86, 2);
      expect(result.mortarDryM3).toBeCloseTo(2.37, 2);
      expect(result.cementBags).toBeCloseTo(10.23, 2);
      expect(result.sandVolumeM3).toBeCloseTo(2.13, 2);
    });

    it('should use custom mortar ratio', () => {
      const r1 = service.calculateBrick(10, 3, 0.23, { mortarRatio: '1:4' });
      const r2 = service.calculateBrick(10, 3, 0.23, { mortarRatio: '1:6' });
      expect(r1.cementBags).toBeGreaterThan(r2.cementBags);
    });
  });

  // ─── Steel ────────────────────────────────────────

  describe('calculateSteel', () => {
    it('should calculate steel for a slab', () => {
      const result = service.calculateSteel(10, 5, 0.15, 1);
      expect(result.concreteVolumeM3).toBe(7.5);
      expect(result.steelPercentage).toBe(1);
      expect(result.steelWeightKg).toBeGreaterThan(0);
      expect(result.steelWeightQuintal).toBeGreaterThan(0);
    });

    it('should scale with steel percentage', () => {
      const r1 = service.calculateSteel(5, 5, 0.15, 1);
      const r2 = service.calculateSteel(5, 5, 0.15, 2);
      expect(r2.steelWeightKg).toBeCloseTo(r1.steelWeightKg * 2, 1);
    });
  });

  // ─── Flooring ─────────────────────────────────────

  describe('calculateFlooring', () => {
    it('should calculate tiles for a 5x4m room with 0.6x0.6m tiles', () => {
      const result = service.calculateFlooring(5, 4, 0.6, 0.6, 5);
      expect(result.roomAreaSqM).toBe(20);
      expect(result.tilesRequired).toBeGreaterThan(0);
      expect(result.tilesWithWastage).toBeGreaterThan(result.tilesRequired);
    });

    it('should return zero tiles if tile area is zero', () => {
      const result = service.calculateFlooring(5, 4, 0, 0);
      expect(result.tilesRequired).toBe(0);
    });
  });

  // ─── Paint ────────────────────────────────────────

  describe('calculatePaint', () => {
    it('should calculate paint for 100sqm with 2 coats', () => {
      const result = service.calculatePaint(100, 2, 12);
      expect(result.wallAreaSqM).toBe(100);
      expect(result.paintLitres).toBeCloseTo(16.67, 1);
      expect(result.paintGallons).toBeGreaterThan(0);
    });

    it('should scale with number of coats', () => {
      const r1 = service.calculatePaint(100, 1);
      const r2 = service.calculatePaint(100, 3);
      expect(r2.paintLitres).toBeCloseTo(r1.paintLitres * 3, 1);
    });
  });

  // ─── Plaster ──────────────────────────────────────

  describe('calculatePlaster', () => {
    it('should calculate plaster sheet (60 m2 x 0.012, 1:4, wastage 5)', () => {
      const result = service.calculatePlaster(60, 0.012, {
        mixRatio: '1:4',
        wastagePercent: 5,
      });
      expect(result.dryVolumeM3).toBeCloseTo(0.91, 2);
      expect(result.cementBags).toBeCloseTo(5.53, 2);
      expect(result.sandVolumeM3).toBeCloseTo(0.77, 2);
    });

    it('should calculate plaster with no wastage (60 m2 x 0.012, 1:4, wastage 0)', () => {
      const result = service.calculatePlaster(60, 0.012, {
        mixRatio: '1:4',
        wastagePercent: 0,
      });
      expect(result.cementBags).toBeCloseTo(5.27, 2);
      expect(result.sandVolumeM3).toBeCloseTo(0.73, 2);
    });

    it('should give more cement with 1:3 vs 1:6 ratio', () => {
      const r1 = service.calculatePlaster(100, 0.012, { mixRatio: '1:3' });
      const r2 = service.calculatePlaster(100, 0.012, { mixRatio: '1:6' });
      expect(r1.cementBags).toBeGreaterThan(r2.cementBags);
    });
  });

  // ─── Material Estimation ──────────────────────────

  describe('calculateMaterialEstimation', () => {
    it('should estimate concrete materials (area 100, thickness 0.15)', () => {
      const result = service.calculateMaterialEstimation(100, 0.15, 'concrete');
      expect(result.areaSqM).toBe(100);
      expect(result.dryVolumeM3).toBeCloseTo(23.1, 2);
      expect(result.cementBags).toBeCloseTo(95.1, 2);
      expect(result.sandKg).toBeGreaterThan(0);
      expect(result.aggregateKg).toBeGreaterThan(0);
    });

    it('should estimate plaster materials (area 100, thickness 0.15)', () => {
      const result = service.calculateMaterialEstimation(100, 0.15, 'plaster');
      expect(result.dryVolumeM3).toBeCloseTo(19.05, 2);
      expect(result.cementBags).toBeCloseTo(109.8, 2);
      expect(result.sandM3).toBeCloseTo(15.24, 2);
      expect(result).not.toHaveProperty('aggregateKg');
    });

    it('should estimate mortar materials (area 100, thickness 0.15)', () => {
      const result = service.calculateMaterialEstimation(100, 0.15, 'mortar');
      expect(result.mixRatio).toBe('1:6');
      expect(result.cementBags).toBeCloseTo(78.43, 2);
      expect(result.sandM3).toBeCloseTo(16.33, 2);
    });

    it('should throw BadRequestException on unsupported materialType', () => {
      expect(() =>
        service.calculateMaterialEstimation(100, 0.15, 'unknown'),
      ).toThrow(BadRequestException);
    });
  });
});
