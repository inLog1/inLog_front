'use client'

import { Settings } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '../../../../shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../../shared/ui/dialog'

import { Checkbox } from '../../../../shared/ui/checkbox'
import { Label } from '../../../../shared/ui/label'
import { Switch } from '../../../../shared/ui/switch'
import type { RoadmapColumnOption } from '../model/types'
import { getDefaultRoadmapColumns } from '../lib/roadmapHelpers'
import { useTranslation } from 'react-i18next'

export interface ColumnOption {
  id: string
  label: string
}

interface Props {
  value?: {
    showTable: boolean
    visibleColumns: RoadmapColumnOption[]
  }
  onChange?: (value: {
    showTable: boolean
    visibleColumns: RoadmapColumnOption[]
  }) => void
}

export default function RoadmapSettings({
  value,
  onChange,
}: Props) {
    const { t } = useTranslation()
    const columns = useMemo(() => getDefaultRoadmapColumns(t), [t]).map(col => ({ id: col.id, label: col.header }))
  const [showTable, setShowTable] = useState(value?.showTable ?? true)
  const [visibleColumns, setVisibleColumns] = useState<RoadmapColumnOption[]>(
    value?.visibleColumns ?? columns
  )

  useEffect(() => {
    onChange?.({
      showTable,
      visibleColumns,
    })
  }, [showTable, visibleColumns])

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="w-5 h-5" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('tasks-page.roadmap.settings')}</DialogTitle>
        </DialogHeader>

        {/* show table */}
        <div className="flex items-center justify-between py-3">
          <Label>{t('common.show-table')}</Label>
          <Switch
            checked={showTable}
            onCheckedChange={setShowTable}
          />
        </div>

        {showTable && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('common.columns')}
            </p>

            <div className="space-y-2">
              {columns.map(col => (
                <div
                  key={col.id}
                  className="flex items-center justify-between"
                >
                  <Label className="text-sm">
                    {col.label}
                  </Label>

                  <Checkbox
                    disabled={col.id === 'text'}
                    className='cursor-pointer'
                    checked={visibleColumns.some(c => c.id === col.id)}
                    onCheckedChange={() => setVisibleColumns(prev =>
                        prev.some(c => c.id === col.id)
                          ? prev.filter(c => c.id !== col.id)
                          : [...prev, { id: col.id, label: col.label }]
                      )}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}