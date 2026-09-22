import { useTranslation } from 'react-i18next'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../../../shared/ui/accordion'
import { Skeleton } from '../../../../shared/ui/skeleton'

const TableSkeleton = () => (
    <div className="rounded-md border border-border/50 overflow-hidden">
        <div className="flex gap-2 bg-muted/50 p-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-20 ml-auto" />
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex gap-2 border-t border-border/50 p-3">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-16 ml-auto" />
            </div>
        ))}
    </div>
)

const ConstructorNodeDetailsSkeleton = () => {
    const { t } = useTranslation()

    return (
        <div>
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-8 w-8 rounded-md" />
            </div>

            <Accordion
                type="multiple"
                className="mt-4"
                defaultValue={['table', 'tabs', 'relatives']}
            >
                <AccordionItem value="table">
                    <AccordionTrigger>{t('admin-page.table')}</AccordionTrigger>
                    <AccordionContent>
                        <TableSkeleton />
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="relatives">
                    <AccordionTrigger>{t('admin-page.relatives')}</AccordionTrigger>
                    <AccordionContent>
                        <Skeleton className="h-10 w-full" />
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="tabs">
                    <AccordionTrigger>{t('admin-page.tabs')}</AccordionTrigger>
                    <AccordionContent>
                        <div className="flex flex-wrap gap-2 mb-4">
                            <Skeleton className="h-9 w-24" />
                            <Skeleton className="h-9 w-28" />
                            <Skeleton className="h-9 w-20" />
                        </div>
                        <TableSkeleton />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    )
}

export default ConstructorNodeDetailsSkeleton
