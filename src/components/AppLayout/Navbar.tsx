export default function Navbar(): React.JSX.Element {
	return (
		<>
			<div className="navbar bg-base-100 lg:hidden bg-transparent">
				<div className="flex-none">
					<label
						htmlFor="my-drawer"
						className="btn btn-square btn-ghost"
					>
						<svg
							fill="none"
							viewBox="0 0 24 24"
							className="inline-block h-5 w-5 stroke-current"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M4 6h16M4 12h16M4 18h16"
							></path>
						</svg>
					</label>
				</div>
				<div className="flex-1"></div>
			</div>
		</>
	);
}
