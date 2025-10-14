import { useEffect, useRef, useState } from "react"
import {
  LuCircleHelp,
  LuFocus,
  LuLasso,
  LuRedo,
  LuUndo,
  LuUpload,
} from "react-icons/lu"
import IconButton from "./IconButton"

function Editor() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [image, setImage] = useState<{
    width: number
    height: number
    data: string | null
  }>({ width: 0, height: 0, data: null })

  const [transform, setTransform] = useState({
    x: 0,
    y: 0,
    zoom: 1,
  })

  // ✅ Upload handler
  const uploadHandler = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = () => {
          if (!ref.current) return
          const canvas = ref.current

          // Hitung rasio untuk fit-to-screen
          const scaleX = canvas.width / img.width
          const scaleY = canvas.height / img.height
          const fitZoom = Math.min(scaleX, scaleY) // biar semua gambar masuk

          // Posisi supaya gambar di tengah
          const x = (canvas.width - img.width * fitZoom) / 2
          const y = (canvas.height - img.height * fitZoom) / 2

          setImage({
            width: img.width,
            height: img.height,
            data: img.src,
          })
          setTransform({ x, y, zoom: fitZoom })
        }
        img.src = event.target?.result as string
      }
      reader.readAsDataURL(file)
    }
    document.body.appendChild(input)
    input.click()
    document.body.removeChild(input)
  }

  // ✅ Gambar ulang setiap kali transform berubah
  useEffect(() => {
    if (!ref.current || !image.data) return
    const canvas = ref.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.src = image.data

    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.translate(transform.x, transform.y)
      ctx.scale(transform.zoom, transform.zoom)
      ctx.drawImage(img, 0, 0)
      ctx.restore()
    }
  }, [image, transform])

  // ✅ Resize canvas ke ukuran tampilan
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    const resize = () => {
      const oldWidth = canvas.width
      const oldHeight = canvas.height

      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight

      // kalau sudah ada gambar, refit lagi
      if (image.data) {
        const img = new Image()
        img.src = image.data
        img.onload = () => {
          const scaleX = canvas.width / img.width
          const scaleY = canvas.height / img.height
          const fitZoom = Math.min(scaleX, scaleY)
          const x = (canvas.width - img.width * fitZoom) / 2
          const y = (canvas.height - img.height * fitZoom) / 2
          setTransform({ x, y, zoom: fitZoom })
        }
      }
    }

    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [image.data])

  // ✅ Zoom dengan scroll
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    const handleWheel = (e: WheelEvent) => {
      if (!image.data) return
      e.preventDefault()

      const { offsetX, offsetY, deltaY } = e
      const zoomIntensity = 0.1
      const direction = deltaY > 0 ? -1 : 1
      const factor = 1 + zoomIntensity * direction

      setTransform((prev) => {
        const newZoom = Math.min(Math.max(prev.zoom * factor, 0.05), 20)
        const mouseX = offsetX
        const mouseY = offsetY
        const x = mouseX - (mouseX - prev.x) * (newZoom / prev.zoom)
        const y = mouseY - (mouseY - prev.y) * (newZoom / prev.zoom)
        return { x, y, zoom: newZoom }
      })
    }

    canvas.addEventListener("wheel", handleWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", handleWheel)
  }, [image])

  const handleFocus = () => {
    if (!image.data) return
    const canvas = ref.current
    if (!canvas) return

    const img = new Image()
    img.src = image.data
    img.onload = () => {
      const scaleX = canvas.width / img.width
      const scaleY = canvas.height / img.height
      const fitZoom = Math.min(scaleX, scaleY)
      const x = (canvas.width - img.width * fitZoom) / 2
      const y = (canvas.height - img.height * fitZoom) / 2
      setTransform({ x, y, zoom: fitZoom })
    }
  }

  return (
    <div className="flex-3 flex relative">
      <div className="flex-1">
        <canvas
          ref={ref}
          className="w-full h-full bg-gray-700 cursor-crosshair"
        />
        {/* toolbar kanan */}
      </div>
      <div className="flex flex-col gap-2 p-2 rounded-r-lg bg-gray-800">
        <IconButton icon={LuUpload} onClick={uploadHandler} />
        <IconButton icon={LuLasso} />
        <IconButton icon={LuFocus} onClick={handleFocus} />
        <IconButton icon={LuUndo} />
        <IconButton icon={LuRedo} />
        <IconButton icon={LuCircleHelp} />
      </div>
      {/* overlay kalau belum ada gambar */}
      {!image.data && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-800/70">
          <p className="text-white">No image uploaded</p>
          <button
            className="bg-blue-500 transition delay-150 duration-300 ease-in-out hover:scale-105 hover:bg-indigo-500 px-6 py-3 rounded-lg text-white cursor-pointer"
            onClick={uploadHandler}
          >
            Upload Image
          </button>
        </div>
      )}
    </div>
  )
}

export default Editor
