import { useEffect, useState } from "react"
import { LuDownload, LuLoaderCircle, LuTrash } from "react-icons/lu"
import Editor from "./components/Editor"
import IconButton from "./components/IconButton"
import useImageProcessor from "./hooks/ImageProcessor"

function App() {
  const {
    image,
    mask,
    resultHistory,
    removeFromHistory,
    process,
    isProcessing,
  } = useImageProcessor()
  const [processTime, setProcessTime] = useState<number | null>(null)

  useEffect(() => {
    let timer: number | null = null
    if (isProcessing) {
      timer = setInterval(() => {
        setProcessTime((prev) => (prev === null ? 1 : prev + 1))
      }, 1000)
    } else {
      setProcessTime(null)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [isProcessing])

  return (
    <div className="bg-gray-950 h-screen text-white flex flex-col">
      <h1 className="px-20 py-5 text-4xl">Kupu</h1>

      <div className="flex flex-1 flex-row p-20 gap-10 pt-0 relative">
        <Editor />

        <div className="flex-1 flex flex-col">
          <button
            className="bg-blue-500 transition delay-150 duration-300 ease-in-out hover:scale-105 hover:bg-indigo-500 px-6 w-full py-3 rounded-lg text-white cursor-pointer mb-8 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
            onClick={async () => {
              if (isProcessing) return
              await process()
            }}
            disabled={isProcessing || !image}
          >
            {isProcessing ? `Processing... (${processTime || 0}s)` : "Process"}
            {isProcessing && (
              <LuLoaderCircle className="inline-block ml-2 animate-spin" />
            )}
          </button>

          <h2 className="mb-3">Result History</h2>

          {/* Make this flex item take all remaining space and scroll only if needed */}
          <div className="h-full relative">
            <div className="flex h-full absolute w-full flex-col gap-2 bg-gray-700 p-4 rounded-lg overflow-y-scroll">
              {resultHistory.length === 0 && (
                <div className="text-gray-400">No results yet</div>
              )}
              {resultHistory.map((result, index) => (
                <div key={index} className="relative">
                  <img
                    src={result}
                    alt={`Result ${index + 1}`}
                    className="rounded border-1 transition ease-out opacity-100 hover:opacity-80 duration-300"
                  />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <IconButton
                      icon={LuTrash}
                      onClick={() => {
                        removeFromHistory(index)
                      }}
                    />
                    <IconButton icon={LuDownload} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
