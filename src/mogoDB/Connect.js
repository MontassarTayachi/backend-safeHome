const mongoose = require('mongoose')

mongoose.connect('mongodb+srv://SafeHome:1234@cluster0.8pyuftz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
.then(
    ()=>{
        {
            console.log('Connected to MongoDB');
        }
    }
)
.catch(
    (err)=>{
        console.error(err);
    }
)


module.exports = mongoose;