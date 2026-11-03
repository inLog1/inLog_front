import { ACCESS_PERMISSION_CATALOG } from '../../../entities/access/model/permission-catalog'

/** Catalog rows for the two system registries. Migration adds them and does not copy them onto stored roles. */
export const REGISTRY_GRANT_DEFINITIONS = ACCESS_PERMISSION_CATALOG
  .filter((item) => item.group === 'system-registries')
  .map((item) => ({
    id: `g-${item.resource.split('.').join('-')}-${item.action}`,
    resource: item.resource,
    action: item.action,
  }))
