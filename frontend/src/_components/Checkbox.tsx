interface CheckboxProps {
    checked: boolean;
    indeterminate?: boolean;
    onChange: () => void;
}

const Checkbox = ({ checked, indeterminate, onChange }: CheckboxProps) => {
    const active = checked || indeterminate;

    return (
        <button
            type="button"
            onClick={onChange}
            className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border-2 transition-colors duration-150 ${
                active ? "border-tertiary bg-tertiary" : "border-tertiary hover:bg-tertiary/10 bg-white"
            }`}
        >
            {indeterminate && !checked ? (
                <span className="block h-0.5 w-2 bg-white" />
            ) : checked ? (
                <svg
                    className="h-2.5 w-2.5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={3}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            ) : null}
        </button>
    );
};

export default Checkbox;
