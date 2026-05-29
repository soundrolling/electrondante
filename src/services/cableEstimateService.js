// src/services/cableEstimateService.js
//
// Persistence for the Cable Estimate module's per-stage floor-plan calibration.
// Calibration lives on the `locations` row (the floor-plan image is per-stage):
//   locations.floorplan_calibration jsonb
//     = { p1:{x,y}, p2:{x,y}, realLength:number, unit:'m'|'ft', imageRef:string }
// Points are normalized floor-plan coords (0..1), matching node x/y.
import { supabase } from '../supabase'
import { createLogger } from '@/utils/log'
import { invalidateProjectCache } from './cacheService'

const log = createLogger('cableEstimateService')

/**
 * Fetch the saved calibration for a stage, or null if none / unavailable.
 * Never throws — a missing column or row just yields null so the UI can
 * fall back to "uncalibrated" mode gracefully.
 * @param {string|number} locationId
 * @returns {Promise<object|null>}
 */
export async function getCalibration(locationId) {
  if (!locationId) return null
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('floorplan_calibration')
      .eq('id', locationId)
      .single()
    if (error) {
      log.warn('getCalibration failed', error.message)
      return null
    }
    return data?.floorplan_calibration ?? null
  } catch (err) {
    log.warn('getCalibration threw', err)
    return null
  }
}

/**
 * Save (or overwrite) the calibration for a stage.
 * @param {string|number} locationId
 * @param {object|null} payload  { p1, p2, realLength, unit, imageRef }
 * @returns {Promise<object|null>} the saved payload
 */
export async function saveCalibration(locationId, payload) {
  if (!locationId) throw new Error('saveCalibration: locationId is required')
  const { error } = await supabase
    .from('locations')
    .update({ floorplan_calibration: payload })
    .eq('id', locationId)
  if (error) {
    log.error('saveCalibration failed', error.message)
    throw error
  }
  return payload
}

/** Remove a stage's calibration. */
export async function clearCalibration(locationId) {
  return saveCalibration(locationId, null)
}

/**
 * Set (or clear) a node's elevation above the floor, in metres. A mic up a
 * tower adds this as a vertical run to its cable length. Pass null to clear.
 * @param {string|number} nodeId
 * @param {number|null} heightMetres
 * @param {string|number} [projectId]  invalidates the cached node list when given
 * @returns {Promise<number|null>} the stored value
 */
export async function setNodeHeight(nodeId, heightMetres, projectId = null) {
  if (!nodeId) throw new Error('setNodeHeight: nodeId is required')
  const value =
    heightMetres == null || heightMetres === '' || !Number.isFinite(Number(heightMetres))
      ? null
      : Number(heightMetres)
  const { error } = await supabase
    .from('nodes')
    .update({ height_m: value })
    .eq('id', nodeId)
  if (error) {
    log.error('setNodeHeight failed', error.message)
    throw error
  }
  if (projectId) invalidateProjectCache(projectId)
  return value
}
