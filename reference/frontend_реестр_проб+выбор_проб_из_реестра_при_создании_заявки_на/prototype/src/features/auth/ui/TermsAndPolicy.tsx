import { useTranslation } from 'react-i18next'

interface TermsAndPolicyProps {
  type: 'terms' | 'policy'
}

export function TermsAndPolicy({ type }: TermsAndPolicyProps) {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'

  // Текст правил (Terms of Use)
  const termsContent = isRu ? (
    <>
      <h2 className="text-2xl font-bold text-center mb-6">
        Пользовательское соглашение
      </h2>

      <p className="text-muted-foreground mb-4">
        Настоящее Пользовательское Соглашение регулирует отношения между ООО «Дата Фактори» (далее — inLog или Администрация) и пользователем сайта.
      </p>

      <p className="text-muted-foreground mb-6">
        Сайт inLog не является средством массовой информации. Используя сайт, Вы соглашаетесь с условиями данного соглашения.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">Предмет соглашения</h3>
      <p className="text-muted-foreground mb-4">
        Администрация предоставляет пользователю право на размещение на сайте следующей информации:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-1 text-muted-foreground">
        <li>Текстовой информации</li>
        <li>Фотоматериалов</li>
        <li>Ссылок на материалы, размещённые на других сайтах</li>
      </ul>

      <h3 className="text-xl font-semibold mt-6 mb-3">Права и обязанности сторон</h3>

      <p className="font-medium mb-2">Пользователь имеет право:</p>
      <ul className="list-disc pl-6 mb-4 space-y-1 text-muted-foreground">
        <li>осуществлять поиск информации на сайте</li>
        <li>получать информацию на сайте</li>
        <li>создавать информацию для сайта</li>
        <li>комментировать контент, выложенный на сайте</li>
        <li>копировать информацию на другие сайты с разрешения Администрации сайта</li>
        <li>копировать информацию на другие сайты с разрешения правообладателя</li>
        <li>требовать от администрации скрытия любой информации о пользователе</li>
        <li>использовать информацию сайта в коммерческих целях с разрешения Администрации</li>
      </ul>

      <p className="font-medium mb-2">Администрация имеет право:</p>
      <ul className="list-disc pl-6 mb-4 space-y-1 text-muted-foreground">
        <li>по своему усмотрению создавать, изменять, отменять правила</li>
        <li>ограничивать доступ к любой информации на сайте</li>
      </ul>

      <p className="font-medium mb-2">Пользователь обязуется:</p>
      <ul className="list-disc pl-6 mb-6 space-y-1 text-muted-foreground">
        <li>обеспечить достоверность предоставляемой информации</li>
        <li>обеспечивать сохранность личных данных от доступа третьих лиц</li>
        <li>обновлять Персональные данные при их изменении</li>
        <li>не нарушать работоспособность сайта</li>
        <li>не создавать несколько учётных записей, если они принадлежат одному лицу</li>
        <li>не передавать свою учётную запись третьим лицам</li>
        <li>не использовать скрипты для автоматизированного сбора информации</li>
      </ul>

      <h3 className="text-xl font-semibold mt-6 mb-3">Ответственность сторон</h3>
      <ul className="list-disc pl-6 mb-6 space-y-1 text-muted-foreground">
        <li>Пользователь лично несёт полную ответственность за распространяемую им информацию</li>
        <li>Администрация не несёт ответственности за достоверность скопированной информации</li>
        <li>В случае форс-мажора (боевые действия, ЧП, стихийные бедствия) Администрация не гарантирует сохранность данных и бесперебойную работу сайта</li>
      </ul>

      <h3 className="text-xl font-semibold mt-6 mb-3">Условия действия Соглашения</h3>
      <p className="text-muted-foreground">
        Соглашение вступает в силу при регистрации. Администрация оставляет за собой право изменять соглашение в одностороннем порядке. Новая версия заменяет предыдущую.
      </p>
    </>
  ) : (
    <>
      <h2 className="text-2xl font-bold text-center mb-6">
        Terms of Use
      </h2>

      <p className="text-muted-foreground mb-4">
        This User Agreement governs the relationship between Data Factory LLC (inLog or Administration) and the user of the site.
      </p>

      <p className="text-muted-foreground mb-6">
        The inLog website is not a mass media outlet. By using the site, you agree to the terms of this agreement.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">Subject of the agreement</h3>
      <p className="text-muted-foreground mb-4">
        The administration grants the user the right to post the following information on the website:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-1 text-muted-foreground">
        <li>Text information</li>
        <li>Photo materials</li>
        <li>Links to materials posted on other sites</li>
      </ul>

      {/* Остальной текст аналогично переводу — можно сократить для примера */}
      <p className="text-muted-foreground">
        The user undertakes to ensure the reliability of the information provided, not to violate the functionality of the site, etc.
      </p>
    </>
  )

  // Текст политики (Privacy Policy)
  const policyContent = isRu ? (
    <>
      <h2 className="text-2xl font-bold text-center mb-6">
        Политика в отношении обработки персональных данных
      </h2>

      <h3 className="text-xl font-semibold mt-6 mb-3">1. Общие положения</h3>
      <p className="text-muted-foreground mb-4">
        Настоящая политика обработки персональных данных составлена в соответствии с требованиями Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» и определяет порядок обработки персональных данных и меры по обеспечению безопасности персональных данных, предпринимаемые ООО «Дата Фактори» (Оператор).
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">2. Основные понятия</h3>
      <ul className="list-disc pl-6 mb-6 space-y-1 text-muted-foreground">
        <li>Автоматизированная обработка персональных данных — обработка с помощью средств вычислительной техники</li>
        <li>Персональные данные — любая информация, относящаяся к определённому пользователю сайта https://inlog.data-factory.ru</li>
        {/* ... остальные пункты по желанию */}
      </ul>

      <h3 className="text-xl font-semibold mt-6 mb-3">3. Основные права и обязанности Оператора</h3>
      <p className="text-muted-foreground">
        Оператор обязуется обеспечивать конфиденциальность персональных данных, принимать меры по их защите и т.д.
      </p>

      {/* Остальные разделы аналогично — сократил для примера */}
    </>
  ) : (
    <>
      <h2 className="text-2xl font-bold text-center mb-6">
        Personal Data Processing Policy
      </h2>

      <p className="text-muted-foreground mb-4">
        This policy complies with Federal Law No. 152-FZ “On Personal Data” and defines the procedure for processing personal data by Data Factory LLC.
      </p>

      {/* Аналогично — можно сократить */}
    </>
  )

  return (
    <div className="prose prose-sm sm:prose-base max-w-none text-muted-foreground">
      {type === 'terms' ? termsContent : policyContent}
    </div>
  )
}