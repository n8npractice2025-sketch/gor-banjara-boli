import { Mic, CheckCircle } from 'lucide-react'

export default function SentenceCard({ sentence, completedCount, totalCount }) {
    if (!sentence) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center animate-pulse">
                <h3 className="text-xl font-medium text-gray-500 dark:text-gray-400">Loading your next sentence...</h3>
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">

            {/* Header Context Menu */}
            <div className="bg-blue-600 dark:bg-blue-900 px-6 py-4 flex flex-row items-center justify-between text-white">
                <div className="flex items-center space-x-2">
                    <Mic className="w-5 h-5" />
                    <span className="font-semibold tracking-wide uppercase text-sm">
                        Recording Task
                    </span>
                </div>
                <div className="text-sm font-medium opacity-90">
                    Sentence ID #{sentence.id}
                </div>
            </div>

            {/* Main Sentence Body */}
            <div className="p-8 pb-12">
                <div className="text-center">
                    <p className="text-sm text-gray-400 font-semibold mb-4 tracking-wider uppercase">
                        Please Read the Following Aloud:
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight">
                        "{sentence.sentence}"
                    </h2>
                </div>

                {/* Progress Tracker Inserted Here Usually */}
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-sm text-gray-500">
                <span className="flex items-center space-x-1 font-medium">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>You have completed {completedCount || 0} recordings</span>
                </span>
            </div>
        </div>
    )
}
