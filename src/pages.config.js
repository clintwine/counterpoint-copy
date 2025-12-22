import CounterpointGenerator from './pages/CounterpointGenerator';
import Home from './pages/Home';
import BulkMidiImport from './pages/BulkMidiImport';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CounterpointGenerator": CounterpointGenerator,
    "Home": Home,
    "BulkMidiImport": BulkMidiImport,
}

export const pagesConfig = {
    mainPage: "CounterpointGenerator",
    Pages: PAGES,
    Layout: __Layout,
};