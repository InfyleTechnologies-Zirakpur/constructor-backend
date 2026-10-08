import { BadRequestException, Injectable } from '@nestjs/common';

export const CALC_CONSTANTS = {
  concreteDryFactor: 1.54,
  mortarDryFactor: 1.27, // brick mortar, plaster, cement, sand, mortar
  cementBagM3: 0.0347,
  cementBagKg: 50,
  sandDensityKgM3: 1550,
  aggregateDensityKgM3: 1450,
  m3ToCft: 35.3147,
  steelKgPerM3Concrete: 80,
  bricksPerM3: 500,
  mortarWetFraction: 0.27,
  defaultConcreteRatio: '1:2:4',
  defaultPlasterRatio: '1:4',
  defaultBrickMortarRatio: '1:6',
  maxWastagePercent: 20,
  gradeRatios: {
    M5: '1:5:10',
    'M7.5': '1:4:8',
    M10: '1:3:6',
    M15: '1:2:4',
    M20: '1:1.5:3',
    M25: '1:1:2',
  },
  flooringAdhesiveKgPerM2: 4.5,
  paintLitresPerGallon: 3.785,
  steelDensityKgM3: 7850,
} as const;

export type ConcreteGrade = keyof typeof CALC_CONSTANTS.gradeRatios;

export interface ConcreteOptions {
  quantity?: number;
  grade?: string;
  mixRatio?: string;
  wastagePercent?: number;
  truckCapacityM3?: number;
  steelKgPerM3?: number;
}

export interface AggregateOptions {
  grade?: string;
  mixRatio?: string;
  wastagePercent?: number;
}

export interface MortarOptions {
  mixRatio?: string;
  wastagePercent?: number;
}

export interface BrickOptions {
  mortarRatio?: string;
  wastagePercent?: number;
}

@Injectable()
export class CalculatorsService {
  /**
   * Helper to parse a mix ratio string like "1:2:4" or "1:4" into parts and sum.
   * Requires expectedParts positive finite numbers, else throws BadRequestException.
   */
  private parseRatio(
    ratio: string,
    expectedParts: number,
  ): { parts: number[]; sum: number } {
    if (!ratio || typeof ratio !== 'string') {
      throw new BadRequestException('Invalid mixRatio');
    }
    const rawParts = ratio.split(':');
    if (rawParts.length !== expectedParts) {
      throw new BadRequestException('Invalid mixRatio');
    }
    const parts = rawParts.map(Number);
    for (const p of parts) {
      if (isNaN(p) || !isFinite(p) || p <= 0) {
        throw new BadRequestException('Invalid mixRatio');
      }
    }
    const sum = parts.reduce((s, c) => s + c, 0);
    if (isNaN(sum) || sum <= 0) {
      throw new BadRequestException('Invalid mixRatio');
    }
    return { parts, sum };
  }

  /**
   * Helper to resolve concrete mix ratio from grade or mixRatio string.
   * Grade wins over mixRatio if provided.
   */
  private resolveConcreteRatio(grade?: string, mixRatio?: string): string {
    if (grade && grade in CALC_CONSTANTS.gradeRatios) {
      return CALC_CONSTANTS.gradeRatios[grade as ConcreteGrade];
    }
    return mixRatio ?? CALC_CONSTANTS.defaultConcreteRatio;
  }

  /**
   * Helper to compute dry volume using specified conversion factor.
   */
  private dryVolume(wetVolume: number, factor: number): number {
    return wetVolume * factor;
  }

  /**
   * Helper to apply wastage percentage.
   */
  private withWastage(value: number, wastagePercent: number): number {
    return value * (1 + wastagePercent / 100);
  }

  /**
   * Helper to convert cement volume in m3 to bags.
   */
  private cementBags(cementM3: number): number {
    return cementM3 / CALC_CONSTANTS.cementBagM3;
  }

  /**
   * Helper to calculate truck delivery requirements.
   * Minimum 1 truck when volume > 0.
   */
  private trucks(volumeM3: number, capacityM3: number) {
    if (volumeM3 <= 0 || capacityM3 <= 0) {
      return {
        count: 0,
        utilisationPercent: 0,
        lastTruckFillPercent: 0,
      };
    }
    const count = Math.max(1, Math.ceil(volumeM3 / capacityM3 - 1e-9));
    const utilisationPercent = this.round(
      (volumeM3 / (count * capacityM3)) * 100,
    );
    const lastTruckFillPercent = this.round(
      ((volumeM3 - (count - 1) * capacityM3) / capacityM3) * 100,
    );
    return {
      count,
      utilisationPercent,
      lastTruckFillPercent,
    };
  }

  // ─── 1. CONCRETE CALCULATOR ─────────────────────────

  calculateConcrete(
    length: number,
    breadth: number,
    height: number,
    opts?: ConcreteOptions,
  ) {
    const quantity = opts?.quantity ?? 1;
    const wastagePercent = opts?.wastagePercent ?? 0;
    const steelKgPerM3 =
      opts?.steelKgPerM3 ?? CALC_CONSTANTS.steelKgPerM3Concrete;
    const grade = opts?.grade;
    const truckCapacityM3 = opts?.truckCapacityM3;

    const wet = length * breadth * height * quantity;
    const dry = this.dryVolume(wet, CALC_CONSTANTS.concreteDryFactor);
    const ratioStr = this.resolveConcreteRatio(grade, opts?.mixRatio);
    const { parts, sum } = this.parseRatio(ratioStr, 3);

    const cementM3 = (dry * parts[0]) / sum;
    const cementBags = this.withWastage(
      this.cementBags(cementM3),
      wastagePercent,
    );
    const sandM3 = this.withWastage((dry * parts[1]) / sum, wastagePercent);
    const aggM3 = this.withWastage((dry * parts[2]) / sum, wastagePercent);

    const sandKg = sandM3 * CALC_CONSTANTS.sandDensityKgM3;
    const sandCft = sandM3 * CALC_CONSTANTS.m3ToCft;
    const aggKg = aggM3 * CALC_CONSTANTS.aggregateDensityKgM3;
    const aggCft = aggM3 * CALC_CONSTANTS.m3ToCft;
    const steelKg = wet * steelKgPerM3;

    const response: Record<string, unknown> = {
      wetVolumeM3: this.round(wet),
      dryVolumeM3: this.round(dry),
      cementBags: this.round(cementBags),
      sandKg: this.round(sandKg),
      sandCft: this.round(sandCft),
      aggregateKg: this.round(aggKg),
      aggregateCft: this.round(aggCft),
      mixRatio: ratioStr,
      ...(grade ? { grade } : {}),
      quantity,
      wastagePercent,
      sandM3: this.round(sandM3),
      aggregateM3: this.round(aggM3),
      steelKg: this.round(steelKg),
      constantsUsed: {
        concreteDryFactor: CALC_CONSTANTS.concreteDryFactor,
        cementBagM3: CALC_CONSTANTS.cementBagM3,
        steelKgPerM3,
        wastagePercent,
      },
    };

    if (truckCapacityM3 !== undefined && truckCapacityM3 > 0) {
      response.trucks = {
        capacityM3: truckCapacityM3,
        sand: this.trucks(sandM3, truckCapacityM3),
        aggregate: this.trucks(aggM3, truckCapacityM3),
      };
    }

    return response;
  }

  // ─── 2. CEMENT CALCULATOR ──────────────────────────

  calculateCement(area: number, thickness: number, opts?: MortarOptions) {
    const mixRatio = opts?.mixRatio ?? CALC_CONSTANTS.defaultPlasterRatio;
    const wastagePercent = opts?.wastagePercent ?? 0;

    const wet = area * thickness;
    const dry = this.dryVolume(wet, CALC_CONSTANTS.mortarDryFactor);
    const { parts, sum } = this.parseRatio(mixRatio, 2);

    const cementM3 = (dry * parts[0]) / sum;
    const cementBags = this.withWastage(
      this.cementBags(cementM3),
      wastagePercent,
    );
    const cementKg = cementBags * CALC_CONSTANTS.cementBagKg;

    return {
      wetVolumeM3: this.round(wet),
      dryVolumeM3: this.round(dry),
      cementBags: this.round(cementBags),
      cementKg: this.round(cementKg),
      mixRatio,
      wastagePercent,
      constantsUsed: {
        mortarDryFactor: CALC_CONSTANTS.mortarDryFactor,
        cementBagM3: CALC_CONSTANTS.cementBagM3,
        cementBagKg: CALC_CONSTANTS.cementBagKg,
        wastagePercent,
      },
    };
  }

  // ─── 3. SAND CALCULATOR ───────────────────────────

  calculateSand(area: number, thickness: number, opts?: MortarOptions) {
    const mixRatio = opts?.mixRatio ?? CALC_CONSTANTS.defaultPlasterRatio;
    const wastagePercent = opts?.wastagePercent ?? 0;

    const wet = area * thickness;
    const dry = this.dryVolume(wet, CALC_CONSTANTS.mortarDryFactor);
    const { parts, sum } = this.parseRatio(mixRatio, 2);

    const sandM3 = this.withWastage((dry * parts[1]) / sum, wastagePercent);
    const sandKg = sandM3 * CALC_CONSTANTS.sandDensityKgM3;
    const sandCft = sandM3 * CALC_CONSTANTS.m3ToCft;

    return {
      wetVolumeM3: this.round(wet),
      dryVolumeM3: this.round(dry),
      sandVolumeM3: this.round(sandM3),
      sandKg: this.round(sandKg),
      sandCft: this.round(sandCft),
      mixRatio,
      wastagePercent,
      constantsUsed: {
        mortarDryFactor: CALC_CONSTANTS.mortarDryFactor,
        sandDensityKgM3: CALC_CONSTANTS.sandDensityKgM3,
        wastagePercent,
      },
    };
  }

  // ─── 4. AGGREGATE CALCULATOR ──────────────────────

  calculateAggregate(
    length: number,
    breadth: number,
    height: number,
    opts?: AggregateOptions,
  ) {
    const grade = opts?.grade;
    const wastagePercent = opts?.wastagePercent ?? 0;

    const wet = length * breadth * height;
    const dry = this.dryVolume(wet, CALC_CONSTANTS.concreteDryFactor);
    const ratioStr = this.resolveConcreteRatio(grade, opts?.mixRatio);
    const { parts, sum } = this.parseRatio(ratioStr, 3);

    const aggM3 = this.withWastage((dry * parts[2]) / sum, wastagePercent);
    const aggKg = aggM3 * CALC_CONSTANTS.aggregateDensityKgM3;
    const aggCft = aggM3 * CALC_CONSTANTS.m3ToCft;

    return {
      wetVolumeM3: this.round(wet),
      dryVolumeM3: this.round(dry),
      aggregateVolumeM3: this.round(aggM3),
      aggregateKg: this.round(aggKg),
      aggregateCft: this.round(aggCft),
      mixRatio: ratioStr,
      ...(grade ? { grade } : {}),
      wastagePercent,
      constantsUsed: {
        concreteDryFactor: CALC_CONSTANTS.concreteDryFactor,
        aggregateDensityKgM3: CALC_CONSTANTS.aggregateDensityKgM3,
        wastagePercent,
      },
    };
  }

  // ─── 5. BRICK CALCULATOR ──────────────────────────

  calculateBrick(
    wallLength: number,
    wallHeight: number,
    wallThickness: number,
    opts?: BrickOptions,
  ) {
    const mortarRatio =
      opts?.mortarRatio ?? CALC_CONSTANTS.defaultBrickMortarRatio;
    const wastagePercent = opts?.wastagePercent ?? 5;

    const wallVol = wallLength * wallHeight * wallThickness;
    const bricksWithoutWastage = Math.ceil(
      wallVol * CALC_CONSTANTS.bricksPerM3 - 1e-9,
    );
    const numberOfBricks = Math.ceil(
      wallVol * CALC_CONSTANTS.bricksPerM3 * (1 + wastagePercent / 100) - 1e-9,
    );

    const mortarWet = wallVol * CALC_CONSTANTS.mortarWetFraction;
    const mortarDry = this.dryVolume(mortarWet, CALC_CONSTANTS.mortarDryFactor);

    const { parts, sum } = this.parseRatio(mortarRatio, 2);
    const cementM3 = (mortarDry * parts[0]) / sum;
    const cementBags = this.withWastage(
      this.cementBags(cementM3),
      wastagePercent,
    );
    const sandM3 = this.withWastage(
      (mortarDry * parts[1]) / sum,
      wastagePercent,
    );

    return {
      wallVolumeM3: this.round(wallVol),
      numberOfBricks,
      bricksWithoutWastage,
      mortarVolumeM3: this.round(mortarWet),
      mortarDryM3: this.round(mortarDry),
      cementBags: this.round(cementBags),
      sandVolumeM3: this.round(sandM3),
      wastagePercent,
      mortarRatio,
      constantsUsed: {
        bricksPerM3: CALC_CONSTANTS.bricksPerM3,
        mortarWetFraction: CALC_CONSTANTS.mortarWetFraction,
        mortarDryFactor: CALC_CONSTANTS.mortarDryFactor,
        cementBagM3: CALC_CONSTANTS.cementBagM3,
        wastagePercent,
      },
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
    const steelWeightKg = steelVolumeM3 * CALC_CONSTANTS.steelDensityKgM3;

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

    // Adhesive: ~4.5 kg per sq. meter of area
    const adhesiveKg = this.round(
      roomArea * CALC_CONSTANTS.flooringAdhesiveKgPerM2,
    );

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
      paintGallons: this.round(
        paintLitres / CALC_CONSTANTS.paintLitresPerGallon,
      ),
    };
  }

  // ─── 9. PLASTER CALCULATOR ────────────────────────

  calculatePlaster(area: number, thickness: number, opts?: MortarOptions) {
    const mixRatio = opts?.mixRatio ?? CALC_CONSTANTS.defaultPlasterRatio;
    const wastagePercent = opts?.wastagePercent ?? 0;

    const wet = area * thickness;
    const dry = this.dryVolume(wet, CALC_CONSTANTS.mortarDryFactor);
    const { parts, sum } = this.parseRatio(mixRatio, 2);

    const cementM3 = (dry * parts[0]) / sum;
    const cementBags = this.withWastage(
      this.cementBags(cementM3),
      wastagePercent,
    );
    const cementKg = cementBags * CALC_CONSTANTS.cementBagKg;

    const sandM3 = this.withWastage((dry * parts[1]) / sum, wastagePercent);
    const sandKg = sandM3 * CALC_CONSTANTS.sandDensityKgM3;
    const sandCft = sandM3 * CALC_CONSTANTS.m3ToCft;

    return {
      wetVolumeM3: this.round(wet),
      dryVolumeM3: this.round(dry),
      cementBags: this.round(cementBags),
      cementKg: this.round(cementKg),
      sandVolumeM3: this.round(sandM3),
      sandKg: this.round(sandKg),
      sandCft: this.round(sandCft),
      mixRatio,
      wastagePercent,
      constantsUsed: {
        mortarDryFactor: CALC_CONSTANTS.mortarDryFactor,
        cementBagM3: CALC_CONSTANTS.cementBagM3,
        cementBagKg: CALC_CONSTANTS.cementBagKg,
        sandDensityKgM3: CALC_CONSTANTS.sandDensityKgM3,
        wastagePercent,
      },
    };
  }

  // ─── 10. GENERAL MATERIAL ESTIMATION ──────────────

  calculateMaterialEstimation(
    area: number,
    thickness = 0.15,
    materialType = 'concrete',
  ) {
    const wetVolume = area * thickness;

    if (materialType === 'concrete') {
      const dryVol = this.dryVolume(
        wetVolume,
        CALC_CONSTANTS.concreteDryFactor,
      );
      const { parts, sum } = this.parseRatio(
        CALC_CONSTANTS.defaultConcreteRatio,
        3,
      );
      const cementM3 = (dryVol * parts[0]) / sum;
      const cementBags = this.cementBags(cementM3);
      const sandM3 = (dryVol * parts[1]) / sum;
      const sandKg = sandM3 * CALC_CONSTANTS.sandDensityKgM3;
      const aggM3 = (dryVol * parts[2]) / sum;
      const aggKg = aggM3 * CALC_CONSTANTS.aggregateDensityKgM3;

      return {
        areaSqM: this.round(area),
        thickness,
        materialType,
        wetVolumeM3: this.round(wetVolume),
        dryVolumeM3: this.round(dryVol),
        cementBags: this.round(cementBags),
        sandM3: this.round(sandM3),
        sandKg: this.round(sandKg),
        aggregateM3: this.round(aggM3),
        aggregateKg: this.round(aggKg),
        mixRatio: CALC_CONSTANTS.defaultConcreteRatio,
      };
    }

    if (materialType === 'plaster') {
      const dryVol = this.dryVolume(wetVolume, CALC_CONSTANTS.mortarDryFactor);
      const { parts, sum } = this.parseRatio(
        CALC_CONSTANTS.defaultPlasterRatio,
        2,
      );
      const cementM3 = (dryVol * parts[0]) / sum;
      const cementBags = this.cementBags(cementM3);
      const sandM3 = (dryVol * parts[1]) / sum;
      const sandKg = sandM3 * CALC_CONSTANTS.sandDensityKgM3;

      return {
        areaSqM: this.round(area),
        thickness,
        materialType,
        wetVolumeM3: this.round(wetVolume),
        dryVolumeM3: this.round(dryVol),
        cementBags: this.round(cementBags),
        cementKg: this.round(cementBags * CALC_CONSTANTS.cementBagKg),
        sandM3: this.round(sandM3),
        sandKg: this.round(sandKg),
        mixRatio: CALC_CONSTANTS.defaultPlasterRatio,
      };
    }

    if (materialType === 'mortar') {
      const dryVol = this.dryVolume(wetVolume, CALC_CONSTANTS.mortarDryFactor);
      const { parts, sum } = this.parseRatio(
        CALC_CONSTANTS.defaultBrickMortarRatio,
        2,
      );
      const cementM3 = (dryVol * parts[0]) / sum;
      const cementBags = this.cementBags(cementM3);
      const sandM3 = (dryVol * parts[1]) / sum;
      const sandKg = sandM3 * CALC_CONSTANTS.sandDensityKgM3;

      return {
        areaSqM: this.round(area),
        thickness,
        materialType,
        wetVolumeM3: this.round(wetVolume),
        dryVolumeM3: this.round(dryVol),
        cementBags: this.round(cementBags),
        cementKg: this.round(cementBags * CALC_CONSTANTS.cementBagKg),
        sandM3: this.round(sandM3),
        sandKg: this.round(sandKg),
        mixRatio: CALC_CONSTANTS.defaultBrickMortarRatio,
      };
    }

    throw new BadRequestException(`Unsupported materialType: ${materialType}`);
  }

  // ─── HELPERS ──────────────────────────────────────

  private round(value: number): number {
    return Number(value.toFixed(2));
  }
}
