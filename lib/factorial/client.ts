// Cliente de Factorial HR para el alta automática de empleados al contratar.
// Usa el SDK oficial @factorialco/api-client (auth por API Key vía x-api-key).
//
// Los IDs de catálogo (company / legal_entity / location) son estables por
// empresa; se obtuvieron con el spike de solo lectura (REC-067) contra la
// cuenta de CrediFlexi y se pueden sobreescribir por env (p.ej. para demo).

import { FactorialClient } from '@factorialco/api-client'

function apiKey(): string {
  const v = process.env.FACTORIAL_API_KEY
  if (!v) throw new Error('FACTORIAL_API_KEY no configurada')
  return v
}

// Catálogo fijo de CrediFlexi (spike REC-067). Overridable por env.
export const FACTORIAL_COMPANY_ID = process.env.FACTORIAL_COMPANY_ID ?? '355437'
export const FACTORIAL_LEGAL_ENTITY_ID = process.env.FACTORIAL_LEGAL_ENTITY_ID ?? '380827'
export const FACTORIAL_LOCATION_ID = process.env.FACTORIAL_LOCATION_ID ?? '488730'

function cliente(): FactorialClient {
  return new FactorialClient({
    apiKey: apiKey(),
    ...(process.env.FACTORIAL_BASE_URL ? { baseUrl: process.env.FACTORIAL_BASE_URL } : {}),
  })
}

export interface AltaEmpleado {
  firstName: string
  lastName: string
  /** Email personal del empleado (obligatorio en Factorial). */
  email: string
  /** Fecha de ingreso (YYYY-MM-DD): arranque del contrato. */
  contractStartsOn?: string
  phoneNumber?: string
  /** id de equipo en Factorial (teams/teams). */
  teamId?: string
  /** uuid del nodo de nivel del puesto (job_catalog/tree_nodes). */
  jobCatalogTreeNodeUuid?: string
}

// Crea el empleado + contrato básico en Factorial. Devuelve el id del empleado.
// Lanza si Factorial responde con error o no devuelve un id.
// El salario y el título del puesto viven en la ContractVersion y se manejan
// aparte (no forman parte de este alta básica).
export async function crearEmpleadoConContrato(alta: AltaEmpleado): Promise<{ id: string }> {
  const client = cliente()
  const res = await client.employees.employees.createWithContract({
    body: {
      company_id: FACTORIAL_COMPANY_ID,
      legal_entity_id: FACTORIAL_LEGAL_ENTITY_ID,
      location_id: FACTORIAL_LOCATION_ID,
      first_name: alta.firstName,
      last_name: alta.lastName,
      email: alta.email,
      ...(alta.contractStartsOn
        ? { contract_starts_on: alta.contractStartsOn, contract_effective_on: alta.contractStartsOn }
        : {}),
      ...(alta.phoneNumber ? { phone_number: alta.phoneNumber } : {}),
      ...(alta.teamId ? { team_id: alta.teamId } : {}),
      ...(alta.jobCatalogTreeNodeUuid ? { job_catalog_tree_node_uuid: alta.jobCatalogTreeNodeUuid } : {}),
    },
  })

  if (res.error) {
    throw new Error(`Factorial rechazó el alta: ${JSON.stringify(res.error)}`)
  }

  // El SDK puede devolver el recurso directo o envuelto en { data }.
  const payload = res.data as { id?: string | number; data?: { id?: string | number } } | undefined
  const id = payload?.id ?? payload?.data?.id
  if (id == null) throw new Error('Factorial no devolvió el id del empleado creado.')
  return { id: String(id) }
}
