'use client';

import { useState, useRef, useCallback } from 'react';
import { UploadCloud, FileText, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface BatchFileUploadProps {
  onFilesSelect: (files: File[]) => void;
  onBatchReview?: () => void;
  disabled?: boolean;
}

// 支持的文件类型
const ACCEPTED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// 文件状态类型
type FileItemStatus = 'ready' | 'invalid';

interface FileItem {
  file: File;
  status: FileItemStatus;
  error?: string;
}

export default function BatchFileUpload({ onFilesSelect, onBatchReview, disabled }: BatchFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 验证单个文件
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    const isValidType =
      ACCEPTED_TYPES.includes(file.type) ||
      ACCEPTED_EXTENSIONS.some(ext => file.name.endsWith(ext));
    if (!isValidType) {
      return { valid: false, error: '不支持的格式' };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: '超过10MB' };
    }
    return { valid: true };
  };

  // 处理新增文件（去重）
  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const items: FileItem[] = fileArray.map(file => {
      const { valid, error } = validateFile(file);
      return { file, status: valid ? 'ready' : 'invalid', error };
    });

    setFileItems(prev => {
      // 去重：按文件名+大小判断
      const existing = new Set(prev.map(item => `${item.file.name}-${item.file.size}`));
      const unique = items.filter(
        item => !existing.has(`${item.file.name}-${item.file.size}`)
      );
      const updated = [...prev, ...unique];
      // 通知父组件
      onFilesSelect(updated.filter(item => item.status === 'ready').map(item => item.file));
      return updated;
    });
  }, [onFilesSelect]);

  // 拖拽放置
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    addFiles(e.dataTransfer.files);
  }, [addFiles, disabled]);

  // 选择文件
  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    // 重置 input 以便重复选择同一文件
    e.target.value = '';
  };

  // 移除单个文件
  const removeFile = (index: number) => {
    setFileItems(prev => {
      const updated = prev.filter((_, i) => i !== index);
      onFilesSelect(updated.filter(item => item.status === 'ready').map(item => item.file));
      return updated;
    });
  };

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // 获取文件类型图标颜色
  const getFileExtension = (filename: string) => {
    const ext = filename.split('.').pop()?.toUpperCase() || '';
    return ext;
  };

  // 开始批量审查
  const handleBatchReview = () => {
    const validFiles = fileItems.filter(item => item.status === 'ready').map(item => item.file);
    if (validFiles.length === 0 || isReviewing || disabled) return;
    setIsReviewing(true);
    onFilesSelect(validFiles);
    onBatchReview?.();
  };

  const validCount = fileItems.filter(item => item.status === 'ready').length;

  return (
    <div className="w-full">
      {/* 拖拽上传区域 */}
      <div
        className={`dropzone rounded-2xl p-12 text-center cursor-pointer ${
          isDragging ? 'dragging' : ''
        } ${disabled || isReviewing ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4">
          <UploadCloud className="w-8 h-8 text-brand-500" />
        </div>
        <p className="text-lg font-medium text-slate-700 mb-1">
          拖拽合同文件到此处，或点击选择
        </p>
        <p className="text-sm text-slate-400">
          支持 PDF、Word(.docx)、文本(.txt) 格式，单文件最大 10MB，可多选
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          multiple
          onChange={handleSelect}
          className="hidden"
        />
      </div>

      {/* 文件列表 */}
      {fileItems.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-600">
              已选择 {fileItems.length} 个文件
              {fileItems.length !== validCount && (
                <span className="text-red-500 ml-2">（{fileItems.length - validCount} 个无效）</span>
              )}
            </h3>
            {!isReviewing && (
              <button
                onClick={() => {
                  setFileItems([]);
                  onFilesSelect([]);
                }}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                清空全部
              </button>
            )}
          </div>

          <div className="space-y-2">
            {fileItems.map((item, index) => (
              <div
                key={`${item.file.name}-${index}`}
                className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* 文件类型图标 */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    item.status === 'invalid' ? 'bg-red-50' : 'bg-brand-50'
                  }`}>
                    {item.status === 'invalid' ? (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <FileText className="w-5 h-5 text-brand-600" />
                    )}
                  </div>

                  {/* 文件信息 */}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800 truncate text-sm">
                      {item.file.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>{formatSize(item.file.size)}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                        {getFileExtension(item.file.name)}
                      </span>
                      {item.status === 'invalid' && (
                        <span className="text-red-500">{item.error}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 移除按钮 */}
                {!isReviewing && (
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                    title="移除文件"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* 审查状态图标（审查进行中时显示） */}
                {isReviewing && (
                  <Loader className="w-4 h-4 text-brand-500 spinner shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* 开始批量审查按钮 */}
          {!isReviewing && validCount > 0 && (
            <button
              onClick={handleBatchReview}
              disabled={disabled || validCount === 0}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl gradient-bg text-white font-semibold shadow-lg shadow-brand-500/30 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-5 h-5" />
              开始批量审查（{validCount} 个文件）
            </button>
          )}
        </div>
      )}
    </div>
  );
}
