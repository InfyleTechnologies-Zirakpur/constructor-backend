import { Injectable } from '@nestjs/common';

@Injectable()
export class CalculatorsService {
  calculateConcrete(
    length: number,
    breadth: number,
    height: number,
    mixRatio = '1:2:4',
  ) {
    const volumeM3 = length * breadth * height;
    const ratioParts = mixRatio.split(':').map(Number);
    const totalRatio =
      ratioParts.reduce((sum, current) => sum + current, 0) || 1;

    const cementVolume = (ratioParts[0] / totalRatio) * volumeM3;
    const sandVolume = (ratioParts[1] / totalRatio) * volumeM3;
    const aggregateVolume = (ratioParts[2] / totalRatio) * volumeM3;

    const cementBags = cementVolume / 0.0347;

    return {
      volumeM3: Number(volumeM3.toFixed(2)),
      cementBags: Number(cementBags.toFixed(2)),
      materialBreakdown: {
        cementVolumeM3: Number(cementVolume.toFixed(2)),
        sandVolumeM3: Number(sandVolume.toFixed(2)),
        aggregateVolumeM3: Number(aggregateVolume.toFixed(2)),
      },
      mixRatio,
    };
  }
}
