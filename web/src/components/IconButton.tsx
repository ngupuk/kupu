import type { IconType } from "react-icons"

type IconButtonProps = {
  icon: IconType
  className?: string
  active?: boolean
} & React.HTMLAttributes<HTMLButtonElement>

function IconButton({
  icon: Icon,
  active,
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      className={`bg-gray-600 hover:bg-indigo-500 flex items-center justify-center rounded-md cursor-pointer size-10 ${
        active ? "bg-indigo-500" : ""
      } ${className} 
      `}
      {...props}
    >
      <Icon />
    </button>
  )
}
export default IconButton
