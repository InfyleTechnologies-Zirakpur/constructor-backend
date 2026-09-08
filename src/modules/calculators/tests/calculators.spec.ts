import { describe, it, expect, beforeEach } from 'vitest';
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
    it('should calculate concrete for 10x5x0.15m slab with 1:2:4 ratio', () => {
      const result = service.calculateConcrete(10, 5, 0.15, '1:2:4');
      expect(result.wetVolumeM3).toBe(7.5);
      expect(result.dryVolumeM3).toBe(11.55);
      expect(result.cementBags).toBeGreaterThan(0);
      expect(result.sandKg).toBeGreaterThan(0);
      expect(result.aggregateKg).toBeGreaterThan(0);
      expect(result.mixRatio).toBe('1:2:4');
    });

    it('should return zero for zero dimensions', () => {
      const result = service.calculateConcrete(0, 0, 0);
      expect(result.wetVolumeM3).toBe(0);
      expect(result.cementBags).toBe(0);
    });

    it('should accept custom mix ratios', () => {
      const r1 = service.calculateConcrete(1, 1, 1, '1:2:4');
      const r2 = service.calculateConcrete(1, 1, 1, '1:1.5:3');
      // Different ratios should give different cement quantities
      expect(r1.cementBags).not.toBe(r2.cementBags);
    });
  });

  // ─── Cement ───────────────────────────────────────

  describe('calculateCement', () => {
    it('should calculate cement for 100sqm area at 12mm thickness', () => {
      const result = service.calculateCement(100, 0.012, '1:4');
      expect(result.wetVolumeM3).toBe(1.2);
      expect(result.cementBags).toBeGreaterThan(0);
      expect(result.cementKg).toBeGreaterThan(0);
    });

    it('should respect different mix ratios', () => {
      const r1 = service.calculateCement(10, 0.02, '1:4');
      const r2 = service.calculateCement(10, 0.02, '1:6');
      // 1:4 gives more cement per volume than 1:6
      expect(r1.cementBags).toBeGreaterThan(r2.cementBags);
    });
  });

  // ─── Sand ─────────────────────────────────────────

  describe('calculateSand', () => {
    it('should calculate sand quantity', () => {
      const result = service.calculateSand(100, 0.02, '1:4');
      expect(result.sandVolumeM3).toBeGreaterThan(0);
      expect(result.sandKg).toBeGreaterThan(0);
      expect(result.sandCft).toBeGreaterThan(0);
    });
  });

  // ─── Aggregate ────────────────────────────────────

  describe('calculateAggregate', () => {
    it('should calculate aggregate for given volume', () => {
      const result = service.calculateAggregate(5, 3, 0.15, '1:2:4');
      expect(result.aggregateVolumeM3).toBeGreaterThan(0);
      expect(result.aggregateKg).toBeGreaterThan(0);
      expect(result.aggregateCft).toBeGreaterThan(0);
    });
  });

  // ─── Brick ────────────────────────────────────────

  describe('calculateBrick', () => {
    it('should calculate bricks for a 10m x 3m x 0.23m wall', () => {
      const result = service.calculateBrick(10, 3, 0.23);
      expect(result.numberOfBricks).toBeGreaterThan(0);
      expect(result.bricksWithoutWastage).toBeGreaterThan(0);
      // With wastage should be higher
      expect(result.numberOfBricks).toBeGreaterThan(
        result.bricksWithoutWastage,
      );
      expect(result.cementBags).toBeGreaterThan(0);
    });

    it('should use custom mortar thickness', () => {
      const thin = service.calculateBrick(10, 3, 0.23, 0.005);
      const thick = service.calculateBrick(10, 3, 0.23, 0.015);
      // Thicker mortar = fewer bricks needed
      expect(thick.bricksWithoutWastage).toBeLessThan(
        thin.bricksWithoutWastage,
      );
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
    it('should calculate plaster for 100sqm at 12mm thickness', () => {
      const result = service.calculatePlaster(100, 0.012, '1:4');
      expect(result.cementBags).toBeGreaterThan(0);
      expect(result.sandKg).toBeGreaterThan(0);
      expect(result.sandCft).toBeGreaterThan(0);
    });

    it('should give more cement with 1:3 vs 1:6 ratio', () => {
      const r1 = service.calculatePlaster(100, 0.012, '1:3');
      const r2 = service.calculatePlaster(100, 0.012, '1:6');
      expect(r1.cementBags).toBeGreaterThan(r2.cementBags);
    });
  });

  // ─── Material Estimation ──────────────────────────

  describe('calculateMaterialEstimation', () => {
    it('should estimate concrete materials by default', () => {
      const result = service.calculateMaterialEstimation(100, 0.15, 'concrete');
      expect(result.areaSqM).toBe(100);
      expect(result.cementBags).toBeGreaterThan(0);
      expect(result.sandKg).toBeGreaterThan(0);
      expect(result.aggregateKg).toBeGreaterThan(0);
    });

    it('should estimate plaster materials', () => {
      const result = service.calculateMaterialEstimation(100, 0.012, 'plaster');
      expect(result.cementBags).toBeGreaterThan(0);
      expect(result.sandKg).toBeGreaterThan(0);
      // Plaster has no aggregate
      expect(result).not.toHaveProperty('aggregateKg');
    });

    it('should estimate mortar materials', () => {
      const result = service.calculateMaterialEstimation(50, 0.02, 'mortar');
      expect(result.mixRatio).toBe('1:6');
      expect(result.cementBags).toBeGreaterThan(0);
    });
  });
});
