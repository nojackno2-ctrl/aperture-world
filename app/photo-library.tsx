"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { playDelete, playPhotoSlide } from "./audio-loader";

const loadHistogram = () => import("./histogram");
const Histogram = dynamic(() => loadHistogram().then(module => module.Histogram), {
  ssr: false,
  loading: () => <div className="playback-histogram histogram-loading" aria-hidden="true" />,
});

const GALLERY_BATCH_SIZE = 48;

export type Photo = {
  id: number;
  scene: string;
  score: number;
  title: string;
  settings: string;
  width: number;
  height: number;
  image: Blob;
  thumb: string;
  params: {
    mode: string;
    drive: string;
    shutter: string;
    aperture: string;
    iso: string;
    focal: string;
    ev: string;
    lens: string;
    focus: string;
  };
};

type Props = {
  shots: Photo[];
  onClose: () => void;
  onDelete: (id: number) => void;
  onClear: () => void;
};

function BlobPhoto({ blob, alt }: { blob: Blob; alt: string }) {
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const url = URL.createObjectURL(blob);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  // The image is a local capture Blob, so framework URL optimization cannot handle it.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={imageRef} className="playback-photo" alt={alt} />;
}

/**
 * The complete photo-library surface stays out of the initial page chunk. Its
 * local selection and pagination state reset naturally whenever the modal is
 * reopened, while the camera page retains ownership of the actual photo card.
 */
export function PhotoLibrary({ shots, onClose, onDelete, onClear }: Props) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
  const [galleryLimit, setGalleryLimit] = useState(GALLERY_BATCH_SIZE);
  const selectedPhoto = selectedPhotoId === null ? undefined : shots.find(photo => photo.id === selectedPhotoId);
  const visibleShots = useMemo(
    () => selectedPhoto ? [] : shots.slice(0, galleryLimit),
    [galleryLimit, selectedPhoto, shots],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    dialog.querySelector<HTMLElement>(".gallery-actions button:not(:disabled)")?.focus({ preventScroll: true });
    return () => {
      if (dialog.open) {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
      }
      returnFocusRef.current?.focus({ preventScroll: true });
      returnFocusRef.current = null;
    };
  }, []);

  const showPhoto = (photo: Photo) => {
    void loadHistogram();
    setSelectedPhotoId(photo.id);
  };

  const downloadPhoto = (photo: Photo) => {
    // Download the stored camera JPEG byte-for-byte. No second canvas pass means
    // the player receives the 0.92-quality photo without another lossy encode.
    const url = URL.createObjectURL(photo.image);
    const link = document.createElement("a");
    const sequence = String(photo.id + 1).padStart(4, "0");
    link.href = url;
    link.download = `aperture-world-${photo.scene}-${sequence}-${photo.width}x${photo.height}.jpg`;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const stepPhoto = (offset: number) => {
    playPhotoSlide();
    if (!shots.length) return;
    const currentIndex = shots.findIndex(photo => photo.id === selectedPhotoId);
    const nextIndex = (Math.max(0, currentIndex) + offset + shots.length) % shots.length;
    showPhoto(shots[nextIndex]);
  };

  const deleteSelectedPhoto = () => {
    playDelete();
    if (!selectedPhoto) return;
    const currentIndex = shots.findIndex(photo => photo.id === selectedPhoto.id);
    const remaining = shots.filter(photo => photo.id !== selectedPhoto.id);
    onDelete(selectedPhoto.id);
    setSelectedPhotoId(remaining.length ? remaining[Math.min(currentIndex, remaining.length - 1)].id : null);
  };

  return (
    <dialog
      ref={dialogRef}
      className="gallery"
      aria-modal="true"
      aria-label="相片庫"
      onCancel={event => {
        event.preventDefault();
        if (selectedPhoto) setSelectedPhotoId(null);
        else onClose();
      }}
      onKeyDown={event => {
        if (!selectedPhoto) return;
        if (event.code === "ArrowLeft") {
          event.preventDefault();
          stepPhoto(-1);
        } else if (event.code === "ArrowRight") {
          event.preventDefault();
          stepPhoto(1);
        } else if (event.code === "Delete" || event.code === "Backspace") {
          event.preventDefault();
          deleteSelectedPhoto();
        }
      }}
    >
      <button type="button" className="gallery-backdrop" aria-label="關閉相片庫" onClick={onClose} />
      <div className="gallery-panel">
        <header>
          <div>
            <p>PHOTO LIBRARY</p>
            <h2>{selectedPhoto ? "照片檢視" : "相片庫"}</h2>
          </div>
          <span>{selectedPhoto ? `${Math.max(0, shots.findIndex(photo => photo.id === selectedPhoto.id)) + 1} / ${shots.length}` : `${shots.length} 張照片`}</span>
          <div className="gallery-actions">
            {selectedPhoto && <button type="button" className="gallery-action-download" aria-label="下載原始高畫質照片" title={`下載 ${selectedPhoto.width} × ${selectedPhoto.height} JPEG`} onClick={() => downloadPhoto(selectedPhoto)}><span aria-hidden="true">DL</span></button>}
            {selectedPhoto && <button type="button" className="gallery-action-delete" aria-label="刪除照片" title="刪除照片 (Delete / Backspace)" onClick={deleteSelectedPhoto}><span aria-hidden="true">DEL</span></button>}
            {selectedPhoto && <button type="button" aria-label="返回相片庫" onClick={() => setSelectedPhotoId(null)}>BACK</button>}
            {!selectedPhoto && shots.length > 0 && <button type="button" className="gallery-action-delete" aria-label="清空相片庫" title="清空所有照片" onClick={() => { onClear(); setSelectedPhotoId(null); }}><span aria-hidden="true">CLEAR</span></button>}
            <button type="button" aria-label="關閉相片庫" onClick={onClose}>CLOSE</button>
          </div>
        </header>
        {selectedPhoto ? <div className="gallery-viewer">
          <div className="viewer-stage">
            <BlobPhoto blob={selectedPhoto.image} alt={`${selectedPhoto.title}，${selectedPhoto.score} 分`} />
            <button className="photo-nav photo-nav-previous" type="button" aria-label="上一張照片" onClick={() => stepPhoto(-1)}>‹</button>
            <button className="photo-nav photo-nav-next" type="button" aria-label="下一張照片" onClick={() => stepPhoto(1)}>›</button>
          </div>
          <div className="viewer-sidebar">
            <div className="viewer-file-meta">
              <span className="viewer-frame-id">100-000{Math.max(1, shots.length - shots.findIndex(photo => photo.id === selectedPhoto.id))}</span>
              <strong>{selectedPhoto.width} × {selectedPhoto.height} JPEG</strong>
            </div>
            <div className="viewer-exposure">
              <b>{selectedPhoto.params.shutter}</b>
              <b>{selectedPhoto.params.aperture}</b>
              <b>{selectedPhoto.params.iso}</b>
              <b>{selectedPhoto.params.focal}</b>
            </div>
            <Histogram image={selectedPhoto.image} />
          </div>
        </div> : shots.length === 0 ? <div className="gallery-empty"><span aria-hidden="true">▧</span><p>還沒有照片</p></div> : <div className="gallery-grid" id="gallery-photo-grid">{visibleShots.map((photo, index) => (
          <div key={photo.id} className="gallery-card">
            <button type="button" className="gallery-card-thumb" aria-label={`檢視照片 #${String(shots.length - index).padStart(2, "0")}，${photo.title}`} onClick={() => showPhoto(photo)}>
              {/* Data-URL thumbnails are already encoded locally and cannot use framework URL optimization. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.thumb} alt={`${photo.title}，${photo.score} 分`} loading="lazy" decoding="async" />
              <span><b>{photo.params.shutter}</b><b>{photo.params.aperture}</b><b>{photo.params.iso}</b><em>#{String(shots.length - index).padStart(2, "0")}</em></span>
            </button>
            <button type="button" className="gallery-card-download" aria-label={`下載照片 #${String(shots.length - index).padStart(2, "0")}，${photo.width} × ${photo.height}`} title="下載原始高畫質照片" onClick={event => { event.stopPropagation(); event.preventDefault(); downloadPhoto(photo); }}>
              <span aria-hidden="true">DL</span>
            </button>
            <button type="button" className="gallery-card-delete" aria-label={`刪除照片 #${String(shots.length - index).padStart(2, "0")}`} title="刪除照片" onClick={event => { event.stopPropagation(); event.preventDefault(); onDelete(photo.id); }}>
              <span aria-hidden="true">DEL</span>
            </button>
          </div>
        ))}{shots.length > GALLERY_BATCH_SIZE && <button
          type="button"
          className="gallery-load-more"
          aria-controls="gallery-photo-grid"
          disabled={visibleShots.length >= shots.length}
          onClick={() => setGalleryLimit(current => Math.min(shots.length, current + GALLERY_BATCH_SIZE))}
        >
          <b>{visibleShots.length >= shots.length ? "已載入全部照片" : "載入更多照片"}</b>
          <small aria-hidden="true">已顯示 {visibleShots.length} / {shots.length}</small>
        </button>}</div>}
      </div>
    </dialog>
  );
}
