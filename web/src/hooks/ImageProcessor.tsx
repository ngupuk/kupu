import { createContext, useContext, useState } from "react"

type Context = {
  image: string | null
  setImage: (img: string | null) => void
  mask: string | null
  setMask: (mask: string | null) => void
  isProcessing: boolean
  process: () => Promise<string>

  resultHistory: string[]
  removeFromHistory: (index: number) => void
}

const ctx = createContext<Context>({
  image: null,
  setImage: () => {},
  mask: null,
  setMask: () => {},
  isProcessing: false,
  process: async () => "",

  resultHistory: [],
  removeFromHistory: () => {},
})

const useImageProcessor = () => {
  return useContext(ctx)
}

export const ImageProcessorProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [image, setImage] = useState<string | null>(null)
  const [mask, setMask] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [resultHistory, setResultHistory] = useState<string[]>([])

  const process = async () => {
    if (!image) return ""
    setProcessing(true)

    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8003"

    const body = {
      image,
      mask,
    }

    const result = await fetch(`${baseUrl}/inpaint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
      .then((res) => res.json())
      .then((data) => data as string)

    setResultHistory((prev) => [result, ...prev])
    setProcessing(false)
    return result
  }

  return (
    <ctx.Provider
      value={{
        image,
        setImage,
        mask,
        setMask,
        isProcessing: processing,
        process,
        resultHistory,
        removeFromHistory: (index: number) => {
          setResultHistory((prev) => prev.filter((_, i) => i !== index))
        },
      }}
    >
      {children}
    </ctx.Provider>
  )
}

export default useImageProcessor
