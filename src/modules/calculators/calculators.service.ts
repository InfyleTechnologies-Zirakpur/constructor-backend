import { Injectable } from '@nestjs/common';

@Injectable()
export class CalculatorsService {
  /**
   * Helper to parse a mix ratio string like "1:2:4" into number array.
   */
  private parseRatio(ratioStr: string): number[] {
    return ratioStr.split(':').map(Number);
  }

  /**
   * Helper to compute dry volume (add 54% for wet-to-dry conversion).
   */
  private dryVolume(wetVolume: number): number {
    return wetVolume * 1.54;
  }

  // ─── 1. CONCRETE CALCULATOR ─────────────────────────

  calculateConcrete(
    length: number,
    breadth: number,
    height: number,
    mixRatio = '1:2:4',
  ) {
    const wetVolume = length * breadth * height;
    const dryVol = this.dryVolume(wetVolume);
    const parts = this.parseRatio(mixRatio);
    const totalRatio = parts.reduce((s, c) => s + c, 0) || 1;

    const cementVolume = (parts[0] / totalRatio) * dryVol;
    const sandVolume = (parts[1] / totalRatio) * dryVol;
    const aggregateVolume = (parts[2] / totalRatio) * dryVol;

    // 1 bag cement = 0.0347 m³
    const cementBags = cementVolume / 0.0347;
    // Sand: 1 m³ ≈ 1550 kg
    const sandKg = sandVolume * 1550;
    // Aggregate: 1 m³ ≈ 1450 kg
    const aggregateKg = aggregateVolume * 1450;

    return {
      wetVolumeM3: this.round(wetVolume),
      dryVolumeM3: this.round(dryVol),
      cementBags: this.round(cementBags),
      sandKg: this.round(sandKg),
      sandCft: this.round(sandVolume * 35.3147),
      aggregateKg: this.round(aggregateKg),
      aggregateCft: this.round(aggregateVolume * 35.3147),
      mixRatio,
    };
  }

  // ─── 2. CEMENT CALCULATOR ──────────────────────────

  calculateCement(area: number, thickness: number, mixRatio = '1:4') {
    const wetVolume = area * thickness;
    const dryVol = this.dryVolume(wetVolume);
    const parts = this.parseRatio(mixRatio);
    const totalRatio = parts.reduce((s, c) => s + c, 0) || 1;

    const cementVolume = (parts[0] / totalRatio) * dryVol;
    const cementBags = cementVolume / 0.0347;
    const cementKg = cementBags * 50;

    return {
      wetVolumeM3: this.round(wetVolume),
      dryVolumeM3: this.round(dryVol),
      cementBags: this.round(cementBags),
      cementKg: this.round(cementKg),
      mixRatio,
    };
  }

  // ─── 3. SAND CALCULATOR ───────────────────────────

  calculateSand(area: number, thickness: number, mixRatio = '1:4') {
    const wetVolume = area * thickness;
    const dryVol = this.dryVolume(wetVolume);
    const parts = this.parseRatio(mixRatio);
    const totalRatio = parts.reduce((s, c) => s + c, 0) || 1;

    // Sand is the second part in the ratio
    const sandPart = parts.length > 1 ? parts[1] : parts[0];
    const sandVolume = (sandPart / totalRatio) * dryVol;
    const sandKg = sandVolume * 1550;

    return {
      wetVolumeM3: this.round(wetVolume),
      dryVolumeM3: this.round(dryVol),
      sandVolumeM3: this.round(sandVolume),
      sandKg: this.round(sandKg),
      sandCft: this.round(sandVolume * 35.3147),
      mixRatio,
    };
  }

  // ─── 4. AGGREGATE CALCULATOR ──────────────────────

  calculateAggregate(
    length: number,
    breadth: number,
    height: number,
    mixRatio = '1:2:4',
  ) {
    const wetVolume = length * breadth * height;
    const dryVol = this.dryVolume(wetVolume);
    const parts = this.parseRatio(mixRatio);
    const totalRatio = parts.reduce((s, c) => s + c, 0) || 1;

    // Aggregate is the third part in the ratio
    const aggPart = parts.length > 2 ? parts[2] : parts[0];
    const aggVolume = (aggPart / totalRatio) * dryVol;
    const aggKg = aggVolume * 1450;

    return {
      wetVolumeM3: this.round(wetVolume),
      dryVolumeM3: this.round(dryVol),
      aggregateVolumeM3: this.round(aggVolume),
      aggregateKg: this.round(aggKg),
      aggregateCft: this.round(aggVolume * 35.3147),
      mixRatio,
    };
  }

  // ─── 5. BRICK CALCULATOR ──────────────────────────

  calculateBrick(
    wallLength: number,
    wallHeight: number,
    wallThickness: number,
    mortarThickness = 0.01,
  ) {
    // Standard Indian brick: 230mm x 115mm x 75mm
    const brickL = 0.23;
    const brickH = 0.075;
    const brickW = 0.115;

    const wallVolume = wallLength * wallHeight * wallThickness;

    // Volume of one brick with mortar
    const brickWithMortar =
      (brickL + mortarThickness) *
      (brickH + mortarThickness) *
      (brickW + mortarThickness);

    const numberOfBricks = Math.ceil(wallVolume / brickWithMortar);

    // Add 5% wastage
    const bricksWithWastage = Math.ceil(numberOfBricks * 1.05);

    // Mortar volume = wall volume - (number of bricks × single brick volume)
    const totalBrickVolume = numberOfBricks * (brickL * brickH * brickW);
    const mortarVolume = wallVolume - totalBrickVolume;
    const dryMortar = this.dryVolume(Math.max(0, mortarVolume));

    // Cement for mortar (1:6 ratio default)
    const cementForMortar = dryMortar / 7;
    const cementBags = cementForMortar / 0.0347;

    return {
      wallVolumeM3: this.round(wallVolume),
      numberOfBricks: bricksWithWastage,
      bricksWithoutWastage: numberOfBricks,
      mortarVolumeM3: this.round(Math.max(0, mortarVolume)),
      cementBags: this.round(cementBags),
      sandVolumeM3: this.round(dryMortar - cementForMortar),
    };
  }

  // ─── 6. STEEL CALCULATOR ──────────────────────────

  calculateSteel(
    length: number,
    breadth: number,
    depth: number,
    steelPercentage = 1,
  ) {
    const concreteVolume = length * breadth * depth;
    // Steel % of concrete volume
    const steelVolumeM3 = concreteVolume * (steelPercentage / 100);
    // Steel density: 7850 kg/m³
    const steelWeightKg = steelVolumeM3 * 7850;

    return {
      concreteVolumeM3: this.round(concreteVolume),
      steelPercentage,
      steelVolumeM3: this.round(steelVolumeM3),
      steelWeightKg: this.round(steelWeightKg),
      steelWeightQuintal: this.round(steelWeightKg / 100),
    };
  }

  // ─── 7. FLOORING / TILE CALCULATOR ────────────────

  calculateFlooring(
    roomLength: number,
    roomBreadth: number,
    tileLength: number,
    tileBreadth: number,
    wastagePercent = 5,
  ) {
    const roomArea = roomLength * roomBreadth;
    const tileArea = tileLength * tileBreadth;

    if (tileArea === 0) {
      return {
        roomAreaSqM: this.round(roomArea),
        tilesRequired: 0,
        tilesWithWastage: 0,
        wastagePercent,
      };
    }

    const tilesRequired = Math.ceil(roomArea / tileArea);
    const wastageCount = Math.ceil(tilesRequired * (wastagePercent / 100));
    const tilesWithWastage = tilesRequired + wastageCount;

    // Adhesive: ~4-5 kg per sq. meter of area
    const adhesiveKg = this.round(roomArea * 4.5);

    return {
      roomAreaSqM: this.round(roomArea),
      tileAreaSqM: this.round(tileArea),
      tilesRequired,
      tilesWithWastage,
      wastagePercent,
      adhesiveKg,
    };
  }

  // ─── 8. PAINT CALCULATOR ──────────────────────────

  calculatePaint(wallArea: number, coats = 2, coveragePerLitre = 12) {
    const totalCoverage = wallArea * coats;
    const paintLitres = totalCoverage / coveragePerLitre;

    return {
      wallAreaSqM: this.round(wallArea),
      coats,
      coveragePerLitre,
      paintLitres: this.round(paintLitres),
      paintGallons: this.round(paintLitres / 3.785),
    };
  }

  // ─── 9. PLASTER CALCULATOR ────────────────────────

  calculatePlaster(area: number, thickness: number, mixRatio = '1:4') {
    const wetVolume = area * thickness;
    const dryVol = this.dryVolume(wetVolume);
    const parts = this.parseRatio(mixRatio);
    const totalRatio = parts.reduce((s, c) => s + c, 0) || 1;

    const cementVolume = (parts[0] / totalRatio) * dryVol;
    const sandVolume = (parts[1] / totalRatio) * dryVol;

    const cementBags = cementVolume / 0.0347;
    const sandKg = sandVolume * 1550;

    return {
      wetVolumeM3: this.round(wetVolume),
      dryVolumeM3: this.round(dryVol),
      cementBags: this.round(cementBags),
      cementKg: this.round(cementBags * 50),
      sandVolumeM3: this.round(sandVolume),
      sandKg: this.round(sandKg),
      sandCft: this.round(sandVolume * 35.3147),
      mixRatio,
    };
  }

  // ─── 10. GENERAL MATERIAL ESTIMATION ──────────────

  calculateMaterialEstimation(
    area: number,
    thickness = 0.15,
    materialType = 'concrete',
  ) {
    const volume = area * thickness;
    const dryVol = this.dryVolume(volume);

    let result: Record<string, unknown> = {
      areaSqM: this.round(area),
      thickness,
      materialType,
      wetVolumeM3: this.round(volume),
      dryVolumeM3: this.round(dryVol),
    };

    switch (materialType) {
      case 'concrete':
        result = {
          ...result,
          ...this.concreteBreakdown(dryVol, '1:2:4'),
        };
        break;
      case 'plaster':
        result = {
          ...result,
          ...this.mortarBreakdown(dryVol, '1:4'),
        };
        break;
      case 'mortar':
        result = {
          ...result,
          ...this.mortarBreakdown(dryVol, '1:6'),
        };
        break;
      default:
        result = {
          ...result,
          ...this.concreteBreakdown(dryVol, '1:2:4'),
        };
    }

    return result;
  }

  // ─── HELPERS ──────────────────────────────────────

  private concreteBreakdown(dryVol: number, mixRatio: string) {
    const parts = this.parseRatio(mixRatio);
    const total = parts.reduce((s, c) => s + c, 0) || 1;

    const cementVol = (parts[0] / total) * dryVol;
    const sandVol = (parts[1] / total) * dryVol;
    const aggVol = (parts[2] / total) * dryVol;

    return {
      cementBags: this.round(cementVol / 0.0347),
      sandM3: this.round(sandVol),
      sandKg: this.round(sandVol * 1550),
      aggregateM3: this.round(aggVol),
      aggregateKg: this.round(aggVol * 1450),
      mixRatio,
    };
  }

  private mortarBreakdown(dryVol: number, mixRatio: string) {
    const parts = this.parseRatio(mixRatio);
    const total = parts.reduce((s, c) => s + c, 0) || 1;

    const cementVol = (parts[0] / total) * dryVol;
    const sandVol = (parts[1] / total) * dryVol;

    return {
      cementBags: this.round(cementVol / 0.0347),
      cementKg: this.round((cementVol / 0.0347) * 50),
      sandM3: this.round(sandVol),
      sandKg: this.round(sandVol * 1550),
      mixRatio,
    };
  }

  private round(value: number): number {
    return Number(value.toFixed(2));
  }
}
