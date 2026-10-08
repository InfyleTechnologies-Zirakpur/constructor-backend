# Calculators Module

Stateless construction estimation calculators module for the INFYLE Construction Platform.

- **Base Route**: `/api/v1/calculators/*`
- **State**: Stateless (no database persistence required)
- **Authentication**: JWT Bearer token required (`AuthGuard('jwt')`)
- **Authorization**: `RolesGuard` (`admin`, `contractor`, `site_engineer`, `company`, `job_seeker`)

---

## Response Envelope Note

The `CalculatorsController` returns raw calculation results directly. The NestJS global `TransformInterceptor` wraps all successful responses into the unified API envelope:

```json
{
  "success": true,
  "message": "Success",
  "data": { ... }
}
```

No double-wrapping occurs. Clients that unwrap `response.data` receive the plain calculator result object.

---

## Endpoints

All endpoints use HTTP `GET` with URL query parameters validated via class-validator DTOs:

| Endpoint | Description | Query Parameters | Default Values |
| :--- | :--- | :--- | :--- |
| `GET /api/v1/calculators/concrete` | Concrete volume, dry volume, cement bags, sand, aggregate, steel & optional truck trips | `length`*, `breadth`*, `height`*, `quantity`, `grade`, `mixRatio`, `wastagePercent`, `truckCapacityM3`, `steelKgPerM3` | `quantity=1`, `mixRatio=1:2:4`, `wastagePercent=0`, `steelKgPerM3=80` |
| `GET /api/v1/calculators/cement` | Mortar/plaster cement quantity | `area`*, `thickness`*, `mixRatio`, `wastagePercent` | `mixRatio=1:4`, `wastagePercent=0` |
| `GET /api/v1/calculators/sand` | Mortar/plaster sand quantity | `area`*, `thickness`*, `mixRatio`, `wastagePercent` | `mixRatio=1:4`, `wastagePercent=0` |
| `GET /api/v1/calculators/aggregate` | Coarse aggregate quantity | `length`*, `breadth`*, `height`*, `grade`, `mixRatio`, `wastagePercent` | `mixRatio=1:2:4`, `wastagePercent=0` |
| `GET /api/v1/calculators/brick` | Standard brickwork quantity | `wallLength`*, `wallHeight`*, `wallThickness`*, `mortarRatio`, `wastagePercent` | `mortarRatio=1:6`, `wastagePercent=5` |
| `GET /api/v1/calculators/steel` | Structural steel reinforcement | `length`*, `breadth`*, `depth`*, `steelPercentage` | `steelPercentage=1` |
| `GET /api/v1/calculators/flooring` | Flooring tiles & adhesive | `roomLength`*, `roomBreadth`*, `tileLength`*, `tileBreadth`*, `wastagePercent` | `wastagePercent=5` |
| `GET /api/v1/calculators/paint` | Wall paint volume & gallons | `wallArea`*, `coats`, `coveragePerLitre` | `coats=2`, `coveragePerLitre=12` |
| `GET /api/v1/calculators/plaster` | Plaster cement & sand quantities | `area`*, `thickness`*, `mixRatio`, `wastagePercent` | `mixRatio=1:4`, `wastagePercent=0` |
| `GET /api/v1/calculators/material-estimation` | General multi-purpose estimation | `area`*, `thickness`, `materialType` (`concrete` \| `plaster` \| `mortar`) | `thickness=0.15`, `materialType=concrete` |

*\* Required parameter (must be positive number).*

---

## Key Formulas & Constants

Single source of truth constants:

| Constant | Value | Description |
| :--- | :--- | :--- |
| `concreteDryFactor` | `1.54` | Wet-to-dry conversion for concrete mixes (+54%) |
| `mortarDryFactor` | `1.27` | Wet-to-dry conversion for mortar, plaster, brickwork (+27%) |
| `cementBagM3` | `0.0347 m³` | Volume of 1 bag (50 kg) of OPC/PPC cement |
| `cementBagKg` | `50 kg` | Mass of standard cement bag |
| `sandDensityKgM3` | `1550 kg/m³` | Bulk density of river sand |
| `aggregateDensityKgM3` | `1450 kg/m³` | Bulk density of coarse gravel/aggregate |
| `m3ToCft` | `35.3147` | Metric cubic meters to cubic feet conversion factor |
| `steelKgPerM3Concrete` | `80 kg/m³` | Standard reinforcement steel density per m³ of finished concrete |
| `steelDensityKgM3` | `7850 kg/m³` | Pure structural steel density |
| `bricksPerM3` | `500` | Standard nominal bricks per m³ of masonry |
| `mortarWetFraction` | `0.27` | Mortar volume fraction in masonry wall volume (27%) |
| `flooringAdhesiveKgPerM2` | `4.5 kg/m²` | Tile adhesive rate per square meter |
| `paintLitresPerGallon` | `3.785 L` | US gallons conversion |

### Concrete Grade Presets

| Grade | Ratio (Cement : Sand : Aggregate) |
| :--- | :--- |
| **M5** | `1:5:10` |
| **M7.5** | `1:4:8` |
| **M10** | `1:3:6` |
| **M15** | `1:2:4` |
| **M20** | `1:1.5:3` |
| **M25** | `1:1:2` |

---

## Important Gotchas & Implementation Notes

1. **Brickwork Openings**: Openings (doors, windows, lintels) are not automatically deducted in the brick calculator. Wall volume is calculated directly as `L * H * T`.
2. **Grade Precedence**: If both `grade` and `mixRatio` are provided to `/concrete` or `/aggregate`, `grade` takes precedence.
3. **Truck Rounding**: Truck trips use `ceil(volumeM3 / capacityM3 - 1e-9)` to prevent floating point inaccuracies from allocating unnecessary additional trucks.
4. **Intermediate Precision**: Floating point precision is preserved throughout all intermediate calculations and rounded to 2 decimal places only upon building the response.
5. **Validation Pipeline**: Validation is performed strictly by class-validator DTOs before entering service logic. Negative dimensions, out-of-range wastage (> 20%), or malformed ratios return HTTP `400 Bad Request`.
