const acceptedTypes = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
]

export const attachmentLimit = 8
export const attachmentAccept = acceptedTypes.join(',')

/** 与当前上传接口使用相同的媒体格式和字节上限。 */
export function attachmentIssue(file: Pick<File, 'type' | 'size'>): 'format' | 'empty' | 'size' | undefined {
  if (!acceptedTypes.includes(file.type)) return 'format'
  if (file.size === 0) return 'empty'
  if (file.size > 16 * 1024 * 1024) return 'size'
}

/** 以当前网页语言显示浏览器报告的文件大小。 */
export function attachmentSize(bytes: number, language: string): string {
  const [unit, divisor] = bytes < 1024 ? ['byte', 1] : bytes < 1024 ** 2
    ? ['kilobyte', 1024] : ['megabyte', 1024 ** 2]
  return new Intl.NumberFormat(language || 'en', {
    style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: 1,
  }).format(bytes / divisor)
}
