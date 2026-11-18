'use client'

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../shared/lib/utils';
import { Button } from '../../../shared/ui/button';
import { TextEditor } from '../../../shared/ui/text-editor';
import { SaveIcon } from 'lucide-react';

interface Props {
    value: string;
    onChange?: (value: string) => void;
}

const TaskDescription = ({ value, onChange }: Props) => {
    const { t } = useTranslation();
    const [localValue, setLocalValue] = useState(value);
    const [isChanged, setIsChanged] = useState(false);

    useEffect(() => {
        setLocalValue(value);
        setIsChanged(false);
    }, [value]);

    const handleLocalChange = useCallback((html: string) => {
        setLocalValue(html);
        setIsChanged(html !== value);
    }, [value]);

    const handleSave = useCallback(() => {
        if (localValue !== value) {
            onChange?.(localValue);
            setIsChanged(false);
        }
    }, [localValue, value, onChange]);

    return (
        <div className="space-y-2">
            <TextEditor
                value={localValue || ''}
                placeholder={t('fields.enter-description')}
                onChange={handleLocalChange}
            />
            
            <div className={cn(
                "flex justify-end gap-2",
            )}>
                <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!isChanged}
                    className={cn(
                        "gap-2",
                        'cursor-pointer',
                        !isChanged && "opacity-50 cursor-not-allowed"
                    )}
                >
                    {t('buttons.save')}
                    <SaveIcon className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}

export default TaskDescription;