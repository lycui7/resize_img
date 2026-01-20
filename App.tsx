
import React, { useState, useRef, useCallback } from 'react';
import { Upload, Download, RefreshCw, AlertCircle, CheckCircle2, FileImage } from 'lucide-react';

/**
 * ID Photo Resizer
 * Goal: Increase/Adjust file size of an ID photo without changing its pixel dimensions.
 * Targets a specific range (150KB - 250KB) with a preferred center of ~200KB.
 */

const TARGET_WIDTH = 295;
const TARGET_HEIGHT = 413;
const MIN_KB = 150;
const MAX_KB = 250;
const PREFERRED_KB = 200; // Updated target center

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string, size: number } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [processedSize, setProcessedSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('请上传图片文件 (JPG/PNG)');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setImage(result);
        setFileInfo({ name: file.name, size: file.size });
        setProcessedImage(null);
        setProcessedSize(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = useCallback(async () => {
    if (!image) return;
    setProcessing(true);
    setError(null);

    try {
      const img = new Image();
      img.src = image;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = TARGET_WIDTH;
      canvas.height = TARGET_HEIGHT;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('Canvas context failed');

      // Draw background white
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
      ctx.drawImage(img, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);

      /**
       * To increase file size to exactly ~200KB:
       * 1. Export as highest quality JPEG.
       * 2. If it's still below 200KB (likely for 295x413), pad with neutral metadata/bytes.
       */
      
      let finalBlob: Blob | null = null;
      let currentSize = 0;

      // Initial high-quality export
      finalBlob = await new Promise<Blob | null>(res => canvas.toBlob(b => res(b), 'image/jpeg', 1.0));
      if (!finalBlob) throw new Error('Blob generation failed');
      currentSize = finalBlob.size;

      // Aim for the PREFERRED_KB (200KB)
      const targetSizeInBytes = PREFERRED_KB * 1024;
      
      if (currentSize < targetSizeInBytes) {
        const arrayBuffer = await finalBlob.arrayBuffer();
        // Calculate padding to hit exactly around 200KB
        const paddingSize = targetSizeInBytes - currentSize;
        
        if (paddingSize > 0) {
          const paddedBuffer = new Uint8Array(arrayBuffer.byteLength + paddingSize);
          paddedBuffer.set(new Uint8Array(arrayBuffer), 0);
          
          // Use non-zero random-ish data to prevent some aggressive server-side compressors 
          // from stripping the padding (though usually they don't touch the EOF).
          for (let i = arrayBuffer.byteLength; i < paddedBuffer.byteLength; i++) {
            paddedBuffer[i] = (i % 255); 
          }
          finalBlob = new Blob([paddedBuffer], { type: 'image/jpeg' });
          currentSize = finalBlob.size;
        }
      }

      if (finalBlob) {
        setProcessedImage(URL.createObjectURL(finalBlob));
        setProcessedSize(currentSize);
      }
    } catch (err) {
      setError('处理图像时出错，请重试。');
      console.error(err);
    } finally {
      setProcessing(false);
    }
  }, [image]);

  const downloadImage = () => {
    if (processedImage) {
      const link = document.createElement('a');
      link.href = processedImage;
      link.download = `id_photo_200kb_${Math.floor(Date.now() / 1000)}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="flex flex-col min-h-screen font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <FileImage className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">证件照大小调整工具</h1>
          </div>
          <div className="text-sm text-slate-500 hidden sm:block">
            目标: 295x413px | 150KB - 250KB (首选 ~200KB)
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          
          {/* Left: Input/Upload */}
          <section className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold mb-4">第一步：上传原图</h2>
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer flex flex-col items-center justify-center gap-3
                  ${image ? 'border-blue-200 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileChange}
                />
                
                {image ? (
                  <div className="relative group">
                    <img src={image} alt="Preview" className="w-32 h-auto rounded shadow-md border border-white" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                      <p className="text-white text-xs font-medium">更换图片</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-slate-100 p-4 rounded-full">
                      <Upload className="w-8 h-8 text-slate-400" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-slate-700">点击或拖拽上传</p>
                      <p className="text-xs text-slate-400 mt-1">支持 JPG, PNG 格式</p>
                    </div>
                  </>
                )}
              </div>

              {fileInfo && (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                  <span className="text-sm text-slate-600 truncate max-w-[150px]">{fileInfo.name}</span>
                  <span className="text-sm font-semibold text-slate-700">
                    当前大小: {(fileInfo.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              )}
            </div>

            <button
              disabled={!image || processing}
              onClick={processImage}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg
                ${!image || processing 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'}`}
            >
              {processing ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
              {processing ? '正在处理...' : '调整至约 200KB'}
            </button>
          </section>

          {/* Right: Results */}
          <section className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col">
              <h2 className="text-lg font-semibold mb-4">第二步：结果预览</h2>
              
              <div className="flex-1 flex flex-col items-center justify-center border border-slate-100 rounded-xl bg-slate-50 p-4 min-h-[300px]">
                {processedImage ? (
                  <div className="text-center space-y-4">
                    <div className="inline-block p-1 bg-white rounded shadow-lg border border-slate-200">
                      <img src={processedImage} alt="Processed" className="w-[295px] h-[413px] object-cover" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1 text-green-600 font-bold">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>调整成功</span>
                      </div>
                      <p className="text-3xl font-black text-slate-800">
                        {(processedSize! / 1024).toFixed(1)} <span className="text-sm font-normal text-slate-500">KB</span>
                      </p>
                      <div className="flex gap-2 text-xs text-slate-400">
                        <span>尺寸: 295 x 413</span>
                        <span>|</span>
                        <span>已达到首选大小</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 italic">
                    <p>等待处理图片...</p>
                  </div>
                )}
              </div>

              {processedImage && (
                <button
                  onClick={downloadImage}
                  className="mt-6 w-full bg-green-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-all shadow-lg active:scale-[0.98]"
                >
                  <Download className="w-5 h-5" />
                  保存优化后的图片
                </button>
              )}
            </div>
          </section>
        </div>

        {/* Requirements Table */}
        <section className="mt-12 bg-blue-50/50 rounded-2xl p-6 border border-blue-100">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="text-blue-600 w-5 h-5" />
            <h3 className="font-bold text-blue-900">处理说明</h3>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-blue-100">
              <p className="text-xs text-slate-400 mb-1">目标尺寸</p>
              <p className="font-bold text-slate-700">295 × 413 像素</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-blue-100">
              <p className="text-xs text-slate-400 mb-1">首选大小</p>
              <p className="font-bold text-slate-700">约 200 KB</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-blue-100">
              <p className="text-xs text-slate-400 mb-1">处理方案</p>
              <p className="font-bold text-slate-700 text-sm">精确字节填充技术</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500 leading-relaxed">
            * 提示：为了确保能通过 150KB-250KB 的审核区间，我们将目标锁定在 200KB 左右。即使原图非常精简，本工具也能通过增加安全元数据的方式，将体积提升至最稳妥的范围内。
          </p>
        </section>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <p className="font-medium">{error}</p>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-slate-400 text-sm">
          <p>© 2024 证件照专业处理工具 - 满足您的报考需求</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
