import type { VisibilityCondition } from "@/types/domain"

export function evaluateConditions(
  conditions: VisibilityCondition[] | undefined,
  answers: Record<string, unknown>
): boolean {
  if (!conditions || conditions.length === 0) return true

  return conditions.every((cond) => {
    const val = answers[cond.field]
    switch (cond.operator) {
      case "eq":         return val === cond.value
      case "neq":        return val !== cond.value
      case "gt":         return Number(val) > Number(cond.value)
      case "lt":         return Number(val) < Number(cond.value)
      case "gte":        return Number(val) >= Number(cond.value)
      case "lte":        return Number(val) <= Number(cond.value)
      case "not_empty":  return val !== undefined && val !== null && val !== ""
      case "empty":      return val === undefined || val === null || val === ""
      case "includes":
        if (Array.isArray(val)) return val.includes(cond.value)
        return false
      default: return true
    }
  })
}

export function evaluateClinicalAlert(
  condition: string,
  value: unknown
): boolean {
  try {
    const numVal = Number(value)
    const match = condition.match(/value\s*(>=|<=|>|<|==|!=)\s*(\d+)/)
    if (!match) return false
    const [, op, threshold] = match
    const t = Number(threshold)
    switch (op) {
      case ">=": return numVal >= t
      case "<=": return numVal <= t
      case ">":  return numVal > t
      case "<":  return numVal < t
      case "==": return numVal === t
      case "!=": return numVal !== t
      default:   return false
    }
  } catch { return false }
}

export function computeScore(
  answers: Record<string, unknown>,
  fields: Array<{ key: string; scoring?: { weight?: number } }>
): number {
  return fields.reduce((sum, field) => {
    const val = answers[field.key]
    const weight = field.scoring?.weight ?? 1
    if (typeof val === "number") return sum + val * weight
    return sum
  }, 0)
}