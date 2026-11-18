'use client'

import { Color } from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import Typography from '@tiptap/extension-typography'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
    Bold,
    ChevronDown,
    Italic,
    List,
    ListOrdered,
    Palette,
    Redo,
    Undo
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '../lib/utils'

const FontSize = TextStyle.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            fontSize: {
                default: null,
                parseHTML: element => element.style.fontSize,
                renderHTML: attributes => {
                    if (!attributes.fontSize) return {}
                    return { style: `font-size: ${attributes.fontSize}` }
                },
            },
        }
    },

    addCommands() {
        return {
            setFontSize: (fontSize: string) => ({ chain }) => {
                return chain().setMark('textStyle', { fontSize }).run()
            },
            unsetFontSize: () => ({ chain }) => {
                return chain().setMark('textStyle', { fontSize: null }).run()
            },
        }
    },
})

// Доступные шрифты
const fonts = [
    { name: 'Montserrat', value: 'Montserrat' },
    { name: 'Roboto', value: 'Roboto' },
    { name: 'Raleway', value: 'Raleway' },
    { name: 'Lato', value: 'Lato' },
    { name: 'Rubik', value: 'Rubik' },
]

// Доступные размеры
const sizes = [
    { name: '10', value: '10px' },
    { name: '11', value: '11px' },
    { name: '12', value: '12px' },
    { name: '14', value: '14px' },
    { name: '16', value: '16px' },
    { name: '18', value: '18px' },
    { name: '20', value: '20px' },
    { name: '24', value: '24px' },
]

interface TextEditorProps {
    value?: string
    onChange?: (html: string) => void
    placeholder?: string
    className?: string
    minHeight?: string
    disabled?: boolean
}

export const TextEditor = ({
    value = '',
    onChange,
    placeholder = 'Введите текст...',
    className,
    minHeight = '150px',
    disabled = false
}: TextEditorProps) => {
    const [showFonts, setShowFonts] = useState(false)
    const [showSizes, setShowSizes] = useState(false)
    const [showColors, setShowColors] = useState(false)

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: false,
                codeBlock: false,
                blockquote: false,
                horizontalRule: false,
            }),
            Placeholder.configure({
                placeholder,
            }), TextStyle,
            FontFamily.configure({
                types: ['textStyle'],
            }),
            Color,
            FontSize,
            Typography,

        ],
        content: value,
        editable: !disabled,
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: cn(
                    'prose prose-sm max-w-none focus:outline-none p-4',
                    disabled && 'cursor-not-allowed opacity-70'
                ),
                style: `min-height: ${minHeight}`,
            },
        },
        onUpdate: ({ editor }) => {
            onChange?.(editor.getHTML())
        },
    })

    if (!editor) {
        return null
    }

    const currentFont = editor.getAttributes('textStyle').fontFamily || 'Montserrat'
    const currentSize = editor.getAttributes('textStyle').fontSize || '14px'

    return (
        <div className={cn(
            "border border-input rounded-md bg-background overflow-hidden",
            disabled && "opacity-50 cursor-not-allowed",
            className
        )}>
            {!disabled && (
                <div className="flex items-center gap-1 p-1 bg-muted/30 border-b border-border flex-wrap">
                    {/* Селектор шрифта */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowFonts(!showFonts)}
                            className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-muted min-w-[100px] justify-between"
                        >
                            <span className="truncate">{currentFont}</span>
                            <ChevronDown className="w-4 h-4 shrink-0" />
                        </button>

                        {showFonts && (
                            <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-md shadow-md z-50 min-w-[150px] max-h-48 overflow-auto">
                                {fonts.map((font) => (
                                    <button
                                        key={font.value}
                                        type="button"
                                        className={cn(
                                            "w-full text-left px-3 py-1.5 text-sm hover:bg-accent",
                                            currentFont === font.value && "bg-accent"
                                        )}
                                        onClick={() => {
                                            editor.chain().focus().setFontFamily(font.value).run()
                                            setShowFonts(false)
                                        }}
                                        style={{ fontFamily: font.value }}
                                    >
                                        {font.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Селектор размера */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowSizes(!showSizes)}
                            className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-muted min-w-[50px] justify-between"
                        >
                            <span>{currentSize.replace('px', '')}</span>
                            <ChevronDown className="w-4 h-4 shrink-0" />
                        </button>

                        {showSizes && (
                            <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-md shadow-md z-50 min-w-[60px] max-h-48 overflow-auto">
                                {sizes.map((size) => (
                                    <button
                                        key={size.value}
                                        type="button"
                                        className={cn(
                                            "w-full text-center px-2 py-1 text-sm hover:bg-accent",
                                            currentSize === size.value && "bg-accent"
                                        )}
                                        onClick={() => {
                                            editor.chain().focus().setFontSize(size.value).run()
                                            setShowSizes(false)
                                        }}
                                    >
                                        {size.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Кнопки форматирования */}
                    <div className="flex items-center gap-1 border-l border-border ml-1 pl-1">
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleBold().run()}
                            className={cn(
                                "p-1.5 rounded hover:bg-muted",
                                editor.isActive('bold') && "bg-muted"
                            )}
                        >
                            <Bold className="w-4 h-4" />
                        </button>

                        <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                            className={cn(
                                "p-1.5 rounded hover:bg-muted",
                                editor.isActive('italic') && "bg-muted"
                            )}
                        >
                            <Italic className="w-4 h-4" />
                        </button>

                        <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleBulletList().run()}
                            className={cn(
                                "p-1.5 rounded hover:bg-muted",
                                editor.isActive('bulletList') && "bg-muted"
                            )}
                        >
                            <List className="w-4 h-4" />
                        </button>

                        <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleOrderedList().run()}
                            className={cn(
                                "p-1.5 rounded hover:bg-muted",
                                editor.isActive('orderedList') && "bg-muted"
                            )}
                        >
                            <ListOrdered className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Цвет текста */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowColors(!showColors)}
                            className="p-1.5 rounded hover:bg-muted"
                        >
                            <Palette className="w-4 h-4" />
                        </button>

                        {showColors && (
                            <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-md shadow-md z-50 p-2">
                                <div className="grid grid-cols-5 gap-1">
                                    {[
                                        '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
                                        '#FF00FF', '#00FFFF', '#808080', '#800000', '#008000',
                                        '#000080', '#800080', '#008080', '#FFA500', '#FFC0CB'
                                    ].map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                                            style={{ backgroundColor: color }}
                                            onClick={() => {
                                                editor.chain().focus().setColor(color).run()
                                                setShowColors(false)
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Undo/Redo */}
                    <div className="flex items-center gap-1 border-l border-border ml-1 pl-1">
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().undo().run()}
                            disabled={!editor.can().undo()}
                            className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                            <Undo className="w-4 h-4" />
                        </button>

                        <button
                            type="button"
                            onClick={() => editor.chain().focus().redo().run()}
                            disabled={!editor.can().redo()}
                            className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                            <Redo className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            <EditorContent editor={editor} />
        </div>
    )
}

export default TextEditor