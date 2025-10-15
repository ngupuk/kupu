import Editor from "./components/Editor"
import useImageProcessor from "./hooks/ImageProcessor"

function App() {
  const { image, mask } = useImageProcessor()
  return (
    <div className="bg-gray-950 min-h-screen text-white flex flex-col">
      <h1 className="px-20 py-5 text-4xl">Kupu</h1>
      <div className="flex flex-1 flex-row p-20 gap-10 pt-0 relative">
        <Editor />
        <div className="flex-1">
          <button className="bg-blue-500 transition delay-150 duration-300 ease-in-out hover:scale-105 hover:bg-indigo-500 px-6 w-full py-3 rounded-lg text-white cursor-pointer mb-8">
            Process
          </button>
          <h2>Result History</h2>
          <div className="flex flex-col gap-4 mt-4">
            <div className="bg-gray-700 p-4 rounded-lg">History Item 1</div>
            <div className="flex flex-col gap-2 bg-gray-500 p-2">
              <div>{image && <img src={image} alt="" />}</div>
              <div>{mask && <img src={mask} alt="" />}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
