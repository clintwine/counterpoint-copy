import BulkMidiImport from './pages/BulkMidiImport';
import Home from './pages/Home';
import CounterpointGenerator from './pages/CounterpointGenerator';
import __Layout from './Layout.jsx';


export const PAGES = {
    "BulkMidiImport": BulkMidiImport,
    "Home": Home,
    "CounterpointGenerator": CounterpointGenerator,
}

export const pagesConfig = {
    mainPage: "CounterpointGenerator",
    Pages: PAGES,
    Layout: __Layout,
};