import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function PdfViewer({ url, page, onDimsChange, onNumPages }) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width || 600);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  function onPageRenderSuccess(p) {
    if (onDimsChange) {
      onDimsChange({ width: p.width, height: p.height });
    }
  }

  function handleLoadSuccess({ numPages }) {
    if (onNumPages) onNumPages(numPages);
  }

  if (!url) {
    return (
      <div className="flex items-center justify-center h-96 text-sm text-gray-400">
        No PDF uploaded
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <Document
        file={url}
        onLoadSuccess={handleLoadSuccess}
        loading={
          <div className="flex items-center justify-center h-96 text-sm text-gray-400">
            Loading PDF…
          </div>
        }
        error={
          <div className="flex items-center justify-center h-96 text-sm text-red-400">
            Failed to load PDF
          </div>
        }
      >
        <Page
          pageNumber={page}
          width={containerWidth}
          onRenderSuccess={onPageRenderSuccess}
          renderAnnotationLayer={false}
          renderTextLayer={false}
        />
      </Document>
    </div>
  );
}
