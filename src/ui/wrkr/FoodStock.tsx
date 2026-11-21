import { selectResources } from '../../state/selectors';
import { formatFull } from '../../utils/format';

/**
 * WRKR's food stock line (Story 1.36, replacing the legacy FoodDisplay). Its
 * rates live in the resource strip and sheet (Story 1.16) and its upkeep in
 * WRKR's readout (Story 1.23). The `food_display` panel (`#food-display`) holds it.
 */
export function FoodStock() {
  return (
    <>
      <h2 class="panel-title">Food</h2>
      <div class="stat-row">
        <span class="stat-label">Stock:</span>
        <span class="stat-value">{formatFull(selectResources.value.food)}</span>
      </div>
    </>
  );
}
