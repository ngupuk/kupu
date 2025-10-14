import { useEffect, useRef, useState } from "react"
import {
  LuCircleHelp,
  LuFocus,
  LuLasso,
  LuRedo,
  LuRefreshCcw,
  LuUndo,
  LuUpload,
} from "react-icons/lu"
import IconButton from "./IconButton"

function Editor() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [isLassoActive, setIsLassoActive] = useState(false)
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

  const [lassos, setLassos] = useState<{ x: number; y: number }[][]>([])
  const [redoHistory, setRedoHistory] = useState<{ x: number; y: number }[][]>(
    []
  )

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
          setLassos([])
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
      // gambar lasso
      const fillAlpha = 0.2
      ctx.strokeStyle = "lime"
      ctx.fillStyle = `rgba(0,255,0,${fillAlpha})`
      ctx.lineWidth = 2
      lassos.forEach((points) => {
        if (points.length < 2) return

        const imagePoint = (p: { x: number; y: number }) => {
          return {
            x: transform.x + p.x * transform.zoom,
            y: transform.y + p.y * transform.zoom,
          }
        }

        ctx.beginPath()
        const start = imagePoint(points[0])
        ctx.moveTo(start.x, start.y)
        points.slice(1).forEach((p) => {
          const pt = imagePoint(p)
          ctx.lineTo(pt.x, pt.y)
        })
        ctx.closePath()
        ctx.stroke()
        ctx.fill()
      })
    }
  }, [image, transform, lassos])

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

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    const handleMouseDown = (e: MouseEvent) => {
      if (!image.data) return
      e.preventDefault()
      const startX = e.clientX
      const startY = e.clientY
      const initX = transform.x
      const initY = transform.y

      const getPointInImage = (clientX: number, clientY: number) => {
        const rect = canvas.getBoundingClientRect()
        const x = (clientX - rect.left - transform.x) / transform.zoom
        const y = (clientY - rect.top - transform.y) / transform.zoom
        return { x, y }
      }
      const points: { x: number; y: number }[] = []
      if (isLassoActive) {
        points.push(getPointInImage(e.clientX, e.clientY))
      }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX
        const dy = moveEvent.clientY - startY
        if (!isLassoActive)
          setTransform((prev) => ({
            ...prev,
            x: initX + dx,
            y: initY + dy,
          }))
        else {
          points.push(getPointInImage(moveEvent.clientX, moveEvent.clientY))
          setRedoHistory([]) // reset redo setiap kali gambar lasso baru
        }
      }

      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
        if (isLassoActive && points.length > 2) {
          setLassos((prev) => [...prev, points])
        }
      }

      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    }

    canvas.addEventListener("mousedown", handleMouseDown)
    return () => canvas.removeEventListener("mousedown", handleMouseDown)
  }, [transform, image, isLassoActive])

  return (
    <div className="flex-3 flex relative">
      <div className="flex-1">
        <canvas
          ref={ref}
          className={`w-full h-full bg-gray-700 ${
            isLassoActive ? "cursor-crosshair" : "cursor-move"
          }`}
        />
        {/* toolbar kanan */}
      </div>
      <div className="flex flex-col gap-2 p-2 rounded-r-lg bg-gray-800">
        <IconButton icon={LuUpload} onClick={uploadHandler} />
        <IconButton
          icon={LuLasso}
          onClick={() => {
            isLassoActive ? setIsLassoActive(false) : setIsLassoActive(true)
          }}
          active={isLassoActive}
        />
        <IconButton icon={LuFocus} onClick={handleFocus} />
        <IconButton
          icon={LuUndo}
          onClick={() => {
            const last = lassos[lassos.length - 1]
            if (!last) return
            setRedoHistory((prev) => [...prev, last])
            setLassos((prev) => prev.slice(0, prev.length - 1))
          }}
        />
        <IconButton
          icon={LuRedo}
          aria-disabled={redoHistory.length === 0}
          className={
            redoHistory.length === 0 ? "opacity-50 cursor-not-allowed" : ""
          }
          onClick={() => {
            const last = redoHistory[redoHistory.length - 1]
            if (!last) return
            setLassos((prev) => [...prev, last])
            setRedoHistory((prev) => prev.slice(0, prev.length - 1))
          }}
        />
        <IconButton icon={LuRefreshCcw} onClick={() => setLassos([])} />
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
