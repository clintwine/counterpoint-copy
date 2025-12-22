import BulkMidiImport from './pages/BulkMidiImport';
import CounterpointGenerator from './pages/CounterpointGenerator';
import Home from './pages/Home';
import __Layout from './Layout.jsx';


export const PAGES = {
    "BulkMidiImport": BulkMidiImport,
    "CounterpointGenerator": CounterpointGenerator,
    "Home": Home,
}

export const pagesConfig = {
    mainPage: "CounterpointGenerator",
    Pages: PAGES,
    Layout: __Layout,
};