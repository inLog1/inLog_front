// ConstructorTableFormDialog.tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AdminPanelGroup } from '../../../../entities/admin/model/types'
import { Button } from '../../../../shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../../../shared/ui/dialog'
import { Input } from '../../../../shared/ui/input'
import { Label } from '../../../../shared/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../shared/ui/select'
import { TagsInput } from '../../../../shared/ui/tags-input'
import type { ColumnConfig } from '../model/types'

export interface ColumnFormData {
  titleEn: string
  titleRu: string
  inputType: AdminPanelGroup['type']
  dropdownOptions?: string[]
}

interface ConstructorTableFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: ColumnFormData) => void
  initialData?: ColumnConfig | null
  isEditing?: boolean
}

const ConstructorTableFormDialog = ({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isEditing = false,
}: ConstructorTableFormDialogProps) => {
  const { t } = useTranslation()
  
  const [formData, setFormData] = useFormState({
    titleEn: '',
    titleRu: '',
    inputType: 'string',
  })

  const [dropdownOptions, setDropdownOptions] = useState<string[]>([])

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      if (isEditing && initialData) {
        setFormData({
          titleEn: initialData.title.en,
          titleRu: initialData.title.ru,
          inputType: initialData.inputType,
        })
      } else {
        setFormData({
          titleEn: '',
          titleRu: '',
          inputType: 'string',
        })
      }
    }
  }, [open, isEditing, initialData, setFormData])

  const handleSubmit = () => {
    // Basic validation
    if (!formData.titleEn || !formData.titleRu) {
      // You can add toast notification here
      return
    }

    const result = {
      ...formData,
    }

    if(formData.inputType === 'dropdown') {
      result.dropdownOptions = dropdownOptions
      setDropdownOptions([])
    }
    
    onSubmit(result)
    onOpenChange(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }
  
  const handleDropdownOptionsChange = (value: string[]) => {
    setDropdownOptions(value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('buttons.edit-column') : t('buttons.add-column')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
        <div className="grid gap-2">
            <Label htmlFor="titleRu">
              {t('fields.name-in-russian')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="titleRu"
              value={formData.titleRu}
              onChange={(e) => setFormData({ ...formData, titleRu: e.target.value })}
              placeholder={t('fields.enter-name-in-russian')}
              autoComplete="off"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="titleEn">
              {t('fields.name-in-english')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="titleEn"
              value={formData.titleEn}
              onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
              placeholder={t('fields.enter-name-in-english')}
              autoComplete="off"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="inputType">
              {t('fields.column-type')} <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.inputType}
              onValueChange={(value: AdminPanelGroup['type']) => 
                setFormData({ ...formData, inputType: value })
              }
            >
              <SelectTrigger id="inputType">
                <SelectValue placeholder={t('fields.select-column-type')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="string">
                  {t('fields.text')}
                </SelectItem>
                <SelectItem value="integer">
                  {t('fields.number')}
                </SelectItem>
                <SelectItem value="date">
                  {t('fields.date')}
                </SelectItem>
                <SelectItem value="file">
                  {t('fields.file')}
                </SelectItem>
                <SelectItem value="dropdown">
                  {t('fields.dropdown')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {
            formData.inputType === 'dropdown' && (
              <div className="grid gap-2">
                <Label htmlFor="dropdownOptions">
                  {t('fields.dropdown-options')}
                </Label>
                <TagsInput
                  value={dropdownOptions}
                  onChange={handleDropdownOptionsChange}
                  placeholder={t('fields.enter-dropdown-options')}
                />
              </div>
            )
          }
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {t('buttons.cancel')}
          </Button>
          <Button onClick={handleSubmit}>
            {isEditing ? t('buttons.save') : t('buttons.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Custom hook for form state management
const useFormState = (initialState: ColumnFormData) => {
  const [formData, setFormData] = useState<ColumnFormData>(initialState || {
    titleEn: '',
    titleRu: '',
    inputType: 'string' as AdminPanelGroup['type'],
  })
  
  return [formData, setFormData] as const
}

export default ConstructorTableFormDialog