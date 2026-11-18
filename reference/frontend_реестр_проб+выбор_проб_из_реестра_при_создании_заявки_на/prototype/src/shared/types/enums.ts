/**
 * Действие над запросом роли (принять/отклонить)
 */
export type RequestAction = 'accept' | 'reject'

/**
 * Статусы ядра/исследования
 */
export type CoreStatus = 'in_progress' | 'finished' | 'error'

/**
 * Типы фотографий керна
 */
export type CorePhotoType = 'full_size_sample' | 'plug' | 'cuttings' | 'other'

/**
 * Типы освещения при съёмке керна
 */
export type CorePhotoLightType = 'visible' | 'ultraviolet' | 'other'

/**
 * Целевые параметры измерений
 */
export type TargetParameter =
  | 'bio'
  | 'bulk_modulus'
  | 'compressibility'
  | 'elastic_limit'
  | 'elastic_wave'
  | 'friction_angle'
  | 'plastic_deformation'
  | 'poissons_ratio'
  | 'shear_modulus'
  | 'ultimate_compressive_strength'
  | 'uniaxial_compressive_strength'
  | 'yield_strength'
  | 'youngs_modulus'
  | 'capillary_curve'
  | 'carbonate_content'
  | 'density'
  | 'oil_displacement'
  | 'permeability'
  | 'porosity'
  | 'saturation'
  | 'thermal_conductivity'
  | 'thermal_diffusivity'
  | 'volumetric_heat_capacity'
  | 'task'

/**
 * Роли пользователей в системе / проекте
 */
export type RoleType = 'admin' | 'member' | 'editor'

/**
 * Типы пористости
 */
export type PorosityType = 'open' | 'effective' | 'dynamic' | 'full'

/**
 * Типы насыщающей жидкости для пористости
 */
export type PorositySaturationFluidType = 'oil' | 'water' | 'kerosene' | 'helium' | 'nitrogen'

/**
 * Приоритеты задач
 */
export type PriorityType = 'low' | 'medium' | 'important' | 'critical'

/**
 * Социальные сети для авторизации
 */
export type SocialName = 'microsoft' | 'slack' | 'yandex' | 'google'

/**
 * Направление компоненты проницаемости
 */
export type PermeabilityComponentType = 'parallel' | 'perpendicular'

/**
 * Языки интерфейса
 */
export type LanguageType = 'ru' | 'en'

/**
 * Положение камеры (для фото/видео)
 */
export type CameraPlacementType = 'face' | 'environment'

/**
 * Уровень детализации дорожной карты
 */
export type RoadMapDetalizationType = 'QUARTER' | 'MONTH' | 'YEAR'

/**
 * Типы объектов в системе (для маршрутов, фильтров и т.д.)
 */
export type ProductObjectType =
  | 'wellpad'           // Куст
  | 'well'              // Скважина
  | 'wellbore'          // Ствол
  | 'core'              // Керн
  | 'researchmethod'    // Метод
  | 'researchequipment' // Оборудование
  | 'studies'           // Исследования
  | 'porositymeasurement'
  | 'permeabilitymeasurement'
  | 'saturationmeasurement'
  | 'oildisplacementmeasurement'
  | 'youngsmodulusmeasurement'
  | 'poissonsratiomeasurement'
  | 'acousticvelocitymeasurement'
  | 'compressibilitymeasurement'
  | 'shearmodulusmeasurement'
  | 'yieldstrengthmeasurement'
  | 'biomeasurement'
  | 'bulkmodulusmeasurement'
  | 'uniaxialcompressivestrengthmeasurement'
  | 'ultimatecompressivestrengthmeasurement'
  | 'elasticlimitmeasurement'
  | 'thermalconductivitymeasurement'
  | 'volumetricheatcapacitymeasurement'
  | 'pyrolysismeasurement'
