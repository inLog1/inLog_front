import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { TaskPriority } from "../../entities/task/model/types"
import { priorityColorStyles } from "../config/constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getPriorityColorStyle = (priority: TaskPriority,type: 'background' | 'border' | 'text' | 'fill') => {
  if (type === 'background') {
    return {
      backgroundColor: priorityColorStyles[priority],
    }
  } else if (type === 'border') {
    return {
      borderColor: priorityColorStyles[priority],
    }
  } else if (type === 'text') {
    return {
      color: priorityColorStyles[priority],
    }
  } else if (type === 'fill') {
    return {
      fill: priorityColorStyles[priority],
    }
  }
}

export const formatFileName = (fileName: string, maxLength: number = 30): string => {
  if (fileName.length <= maxLength) return fileName
  
  const lastDotIndex = fileName.lastIndexOf('.')
  
  if (lastDotIndex === -1) {
    return fileName.slice(0, maxLength - 3) + '...'
  }
  
  const name = fileName.slice(0, lastDotIndex)
  const extension = fileName.slice(lastDotIndex)
  
  const maxNameLength = maxLength - extension.length - 3
  
  if (maxNameLength <= 0) {
    return `...${extension}`
  }
  
  const truncatedName = name.slice(0, maxNameLength)
  return `${truncatedName}...${extension}`
}